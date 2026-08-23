-- Supply Stash — soft-delete bank
-- Source of truth: supply-stash-architecture.md §3 ("Sync-Required Columns"), §5.2
--
-- §3 banks `updated_at` + `deleted` on every synced table. Neither was fully
-- implemented: `deleted` existed nowhere, `updated_at` only on homes, items and
-- device_tokens. Two independent reasons this matters:
--
--   1. Ledger preservation. inventory_transactions.item_id references items
--      ON DELETE CASCADE, so a routine item delete destroyed that item's entire
--      transaction history -- the audit trail §3 and §5.7 are built on.
--   2. §5.8 rung 3. A delta refetch on `updated_at > lastSeen` cannot tell
--      "hard-deleted" from "unchanged"; both are simply absent from the result.
--      `deleted = true` is a change, so it rides the delta and the client learns
--      the row is gone.
--
-- Nothing in the v1 client reads either column (§3) -- this is a deliberate bank,
-- taken now because the tables are empty and taken later would mean a migration,
-- a backfill and a re-audit of every policy.
--
-- Scope: the rows users delete routinely. Whole-home deletion stays a hard
-- delete -- delete_home/remove_member (…0003) keep their DELETE statements and
-- the existing ON DELETE CASCADE FKs do the work. "Delete this home" means
-- erase it all, it is an online-only confirm-dialog operation, and keeping it
-- hard keeps cascade-the-flag logic out of every RPC. homes and user_homes
-- therefore get no `deleted` column.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- 1. Columns
--
-- A non-volatile DEFAULT means Postgres 11+ fills these in via the catalog
-- rather than rewriting the table, so NOT NULL is free here.
-- ============================================================

alter table public.items
  add column if not exists deleted boolean not null default false;

alter table public.categories
  add column if not exists deleted boolean not null default false;

alter table public.shopping_list_items
  add column if not exists deleted boolean not null default false;

alter table public.inventory_transactions
  add column if not exists deleted boolean not null default false;

-- updated_at was missing on four of the synced tables. items, homes and
-- device_tokens already have it (…0001) with triggers from …0005 §1.
alter table public.categories
  add column if not exists updated_at timestamptz not null default now();

alter table public.shopping_list_items
  add column if not exists updated_at timestamptz not null default now();

alter table public.inventory_transactions
  add column if not exists updated_at timestamptz not null default now();

alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

-- ============================================================
-- 2. set_updated_at triggers
--
-- Reuses public.set_updated_at() from …0005 §1.
-- ============================================================

create trigger set_updated_at_on_categories
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_shopping_list_items
before update on public.shopping_list_items
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_inventory_transactions
before update on public.inventory_transactions
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_notifications
before update on public.notifications
for each row
execute function public.set_updated_at();

-- ============================================================
-- 3. Indexes
-- ============================================================

-- §5.2 specifies this index for the recompute trigger's soft-delete filter
-- (section 6 below). The unfiltered items_… index from …0001 stays: it still
-- serves history reads, which want deleted rows too.
create index if not exists inventory_transactions_item_id_live_idx
  on public.inventory_transactions (item_id)
  where deleted = false;

-- A soft-deleted row still occupies the unique key, so `unique (home_id, name)`
-- from …0001 would permanently block recreating a category after deleting it.
-- Scope uniqueness to live rows instead.
alter table public.categories
  drop constraint if exists categories_home_id_name_key;

create unique index if not exists categories_home_id_name_live_key
  on public.categories (home_id, name)
  where deleted = false;

-- ============================================================
-- 4. items: grant and guard the new column
--
-- …0005 §3 revoked UPDATE on items wholesale and re-granted an explicit column
-- list, so `deleted` is unwritable until it joins that list.
-- ============================================================

grant update (deleted) on public.items to authenticated;

-- Column privileges cannot distinguish roles, but the "contributors can update
-- items" policy (…0002) lets a contributor update items. Without this guard a
-- contributor could set deleted = true, which *is* deleting an item, violating
-- the §3 role table: a contributor may edit an item's metadata but may not
-- create or delete items.
--
-- Recreated in full rather than patched, so the whole guard reads in one place.
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

  -- Soft delete is a delete, so it takes the delete role set, not the update
  -- one. Skipped when there is no authenticated user: that is a service_role
  -- or migration path, which bypasses RLS anyway and must stay able to correct
  -- data. Rejected loudly rather than silently reverted -- unlike
  -- current_inventory, this is a deliberate user action, and §5.1 forbids a
  -- write that appears to succeed and does not.
  if new.deleted is distinct from old.deleted
     and auth.uid() is not null
     and coalesce(public.get_home_role(new.home_id), '') not in ('owner', 'admin', 'member')
  then
    raise exception 'Only owners, admins and members can delete items';
  end if;

  return new;
end;
$$;

-- ============================================================
-- 5. shopping_list_items: same guard, same reason
--
-- "contributors can update shopping list items" vs "members can delete
-- shopping list items" (…0002) is the same split as items.
-- ============================================================

create or replace function public.guard_shopping_list_deleted()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.deleted is distinct from old.deleted
     and auth.uid() is not null
     and coalesce(public.get_home_role(new.home_id), '') not in ('owner', 'admin', 'member')
  then
    raise exception 'Only owners, admins and members can delete shopping list items';
  end if;

  return new;
end;
$$;

-- Named to sort before set_updated_at_on_shopping_list_items (triggers fire in
-- name order), so a rejected write never reaches the timestamp bump -- matching
-- the ordering …0005 §3 established on items.
create trigger guard_shopping_list_deleted_on_shopping_list_items
before update on public.shopping_list_items
for each row
execute function public.guard_shopping_list_deleted();

-- categories needs no guard: contributors have no update policy there at all,
-- so the delete role set and the update role set are already identical.

-- ============================================================
-- 6. Deletion is now an UPDATE
--
-- The DELETE policies go away entirely. Dropping them rather than leaving them
-- in place is the point: a hard delete on items still cascades the ledger away,
-- so leaving a working DELETE path would leave the hole this migration exists
-- to close.
--
-- inventory_transactions deliberately gains no UPDATE policy. It stays
-- append-only from the client (§5.7); soft-deleting a ledger row remains a
-- service_role path, which the …0005 §2 recompute trigger already handles.
-- ============================================================

drop policy if exists "members can delete items" on public.items;
drop policy if exists "members can delete categories" on public.categories;
drop policy if exists "members can delete shopping list items" on public.shopping_list_items;

-- ============================================================
-- 7. Recompute skips soft-deleted ledger rows
--
-- Redefined from …0005 §2 with the `deleted = false` filter §5.2 specifies.
-- Everything else -- SECURITY DEFINER, the INSERT/UPDATE/DELETE fan-out, the
-- recalc flag, recompute-from-scratch rather than delta -- is unchanged and
-- documented there.
-- ============================================================

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
          and deleted = false
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

commit;
