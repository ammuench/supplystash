-- Supply Stash — schema hardening
--
-- Closes four gaps between supply-stash-architecture.md and the schema:
--   1. Clients could write items.current_inventory directly, making the
--      ledger invariant decorative (doc §3 line 190: "Clients never write it").
--   2. The ledger -> cached-count trigger fired on INSERT only, so any
--      UPDATE/DELETE of a ledger row (service_role, backfill script, dashboard)
--      left current_inventory permanently wrong and silent.
--   3. The set_updated_at trigger specified in doc §3 was never created, so
--      items.updated_at only advanced via ledger inserts -- metadata edits
--      left it stale, breaking doc §5.2's "when did we last buy this".
--   4. Foreign keys had no indexes on the referencing side.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- 1. Generic updated_at trigger  (doc §3)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_on_items
before update on public.items
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_homes
before update on public.homes
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_device_tokens
before update on public.device_tokens
for each row
execute function public.set_updated_at();

-- ============================================================
-- 2. Ledger -> cached count: fire on INSERT, UPDATE and DELETE
--
-- Recomputes from the ledger rather than applying a delta, so a
-- corrective UPDATE/DELETE converges instead of drifting. When a row's
-- item_id changes, BOTH the old and new item are recomputed.
--
-- Sets a transaction-local flag so the guard trigger in section 3 can
-- tell this write apart from a client write to the same column.
-- ============================================================

-- SECURITY DEFINER is required, not incidental: section 3 revokes
-- UPDATE (current_inventory) from `authenticated`, and this trigger runs in
-- the caller's role. As INVOKER it would be blocked by that revoke -- the
-- ledger could no longer update its own cache. As DEFINER it runs as the
-- table owner, which is exactly the one path allowed to move the column.
-- It takes no arguments, cannot be called outside the trigger, and only ever
-- recomputes a sum over the affected item's own ledger rows.
create or replace function public.update_item_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_ids uuid[];
  v_item_id uuid;
begin
  v_item_ids := case
    when tg_op = 'INSERT' then array[new.item_id]
    when tg_op = 'DELETE' then array[old.item_id]
    when new.item_id is distinct from old.item_id then array[old.item_id, new.item_id]
    else array[new.item_id]
  end;

  perform set_config('supplystash.ledger_recalc', 'on', true);

  foreach v_item_id in array v_item_ids loop
    update public.items
    set
      current_inventory = (
        select coalesce(sum(quantity_changed), 0)
        from public.inventory_transactions
        where item_id = v_item_id
      ),
      updated_at = now()
    where id = v_item_id;
  end loop;

  perform set_config('supplystash.ledger_recalc', 'off', true);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists on_inventory_transaction on public.inventory_transactions;

create trigger on_inventory_transaction
after insert or update or delete on public.inventory_transactions
for each row
execute function public.update_item_inventory();

-- ============================================================
-- 3. Lock derived and identity columns on items
--
-- Two layers, because neither alone is sufficient:
--
--   Column privileges stop ordinary `authenticated` writes on both INSERT
--   and UPDATE. RLS cannot do this -- a USING/WITH CHECK clause gates whole
--   rows, not columns, so the existing items policies permitted any column.
--
--   The guard trigger stops the paths privileges miss: service_role, RPCs
--   marked SECURITY DEFINER, and anything run as the table owner. It lets
--   through only writes flagged by update_item_inventory() above.
-- ============================================================

-- INSERT is locked too: a new item opens at the default 0 and its starting
-- count comes from an opening ledger row, exactly like every later change.
-- Without this, "clients never write current_inventory" would hold for edits
-- but not for creation, and a seeded count would have no ledger behind it.
revoke insert, update on public.items from authenticated;

grant insert (
  id,
  home_id,
  title,
  description,
  photo_url,
  barcode,
  purchase_link,
  warning_amount,
  is_archived,
  created_by_id
) on public.items to authenticated;

grant update (
  title,
  description,
  photo_url,
  barcode,
  purchase_link,
  warning_amount,
  is_archived,
  updated_at
) on public.items to authenticated;

create or replace function public.guard_item_derived_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.home_id is distinct from old.home_id
    or new.created_by_id is distinct from old.created_by_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'items.id, home_id, created_by_id and created_at are immutable';
  end if;

  -- current_inventory is derived from the ledger. Only the ledger trigger
  -- may move it; every other caller silently keeps the existing value.
  if new.current_inventory is distinct from old.current_inventory
     and coalesce(current_setting('supplystash.ledger_recalc', true), 'off') <> 'on'
  then
    new.current_inventory = old.current_inventory;
  end if;

  return new;
end;
$$;

-- Runs before set_updated_at_on_items (triggers fire in name order),
-- so a rejected write never reaches the timestamp bump.
create trigger guard_item_derived_columns_on_items
before update on public.items
for each row
execute function public.guard_item_derived_columns();

-- ============================================================
-- 4. search_path pinning on the remaining function  (Supabase linter)
-- ============================================================

alter function public.enforce_last_owner() set search_path = public, pg_temp;

-- ============================================================
-- 5. Foreign-key indexes
--
-- Postgres does not index the referencing side of a FK automatically.
-- Without these, deleting a category seq-scans item_categories and
-- deleting a user seq-scans inventory_transactions in full.
-- ============================================================

create index if not exists homes_created_by_id_idx
  on public.homes (created_by_id);

create index if not exists items_created_by_id_idx
  on public.items (created_by_id);

create index if not exists inventory_transactions_user_id_idx
  on public.inventory_transactions (user_id);

create index if not exists item_categories_category_id_idx
  on public.item_categories (category_id);

create index if not exists shopping_list_items_item_id_idx
  on public.shopping_list_items (item_id);

create index if not exists notifications_home_id_idx
  on public.notifications (home_id);

create index if not exists notifications_item_id_idx
  on public.notifications (item_id);

commit;
