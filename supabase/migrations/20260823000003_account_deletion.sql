-- Supply Stash — account deletion (GDPR Art. 17)
--
-- Deleting a user account was impossible. Three foreign keys to auth.users used
-- ON DELETE RESTRICT:
--
--   homes.created_by_id            -> auth.users  ON DELETE RESTRICT
--   items.created_by_id            -> auth.users  ON DELETE RESTRICT
--   inventory_transactions.user_id -> auth.users  ON DELETE RESTRICT
--
-- Postgres refuses the delete the moment a person has created a home, created
-- an item, or logged one transaction -- which is to say always. auth.admin
-- .deleteUser() failed on a foreign key violation, so there was no path to
-- honour an erasure request at all.
--
-- The fix is anonymisation rather than retention. auth.users is where the
-- email, name and OAuth identity actually live, and it is hard-deleted. The
-- three historical references are nulled, so the household keeps a coherent
-- ledger and a coherent item catalogue while the link to the person is severed:
-- a ledger row becomes "someone used 1 paper towel", which relates to no
-- identifiable person.
--
-- Rows that are purely about the person -- notifications, device_tokens,
-- user_homes -- already cascade (…0001) and are genuinely destroyed.
-- shopping_list_items.checked_by_id is already ON DELETE SET NULL.
--
-- This is unrelated to the soft-delete bank in …20260823000001: soft delete
-- governs rows a user removes from a household, this governs the person's own
-- account, and the two never meet.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- 1. Make the historical references nullable and self-clearing
--
-- squawk is silenced deliberately at each site below, not in .squawk.toml,
-- so the reasoning sits next to the statement it excuses:
--
--   ban-drop-not-null          -- dropping NOT NULL is the whole point here;
--                                 there is no other way to express "this column
--                                 may be cleared when its owner is erased".
--   adding-foreign-key-constraint,
--   constraint-missing-not-valid
--                              -- both warn about the validation scan locking a
--                                 populated table. These tables are empty: this
--                                 branch has never been deployed, so the scan is
--                                 a no-op. The NOT VALID / VALIDATE split the
--                                 rule asks for needs two transactions, i.e. a
--                                 second migration file whose only purpose is to
--                                 validate zero rows.
--
-- Any *later* migration touching these constraints will be against live data and
-- must take the NOT VALID / VALIDATE route rather than copying this one.
-- ============================================================

-- squawk-ignore ban-drop-not-null
alter table public.homes alter column created_by_id drop not null;

alter table public.homes drop constraint if exists homes_created_by_id_fkey;

-- squawk-ignore adding-foreign-key-constraint, constraint-missing-not-valid
alter table public.homes add constraint homes_created_by_id_fkey foreign key (created_by_id) references auth.users (id) on delete set null;

-- squawk-ignore ban-drop-not-null
alter table public.items alter column created_by_id drop not null;

alter table public.items drop constraint if exists items_created_by_id_fkey;

-- squawk-ignore adding-foreign-key-constraint, constraint-missing-not-valid
alter table public.items add constraint items_created_by_id_fkey foreign key (created_by_id) references auth.users (id) on delete set null;

-- squawk-ignore ban-drop-not-null
alter table public.inventory_transactions alter column user_id drop not null;

alter table public.inventory_transactions drop constraint if exists inventory_transactions_user_id_fkey;

-- squawk-ignore adding-foreign-key-constraint, constraint-missing-not-valid
alter table public.inventory_transactions add constraint inventory_transactions_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- Nullable only for anonymisation, never for creation: the insert policies in
-- …0002 pin both columns to auth.uid() ("members can insert items",
-- "contributors can insert transactions"), so a client still cannot author an
-- ownerless row.

-- ============================================================
-- 2. Let the anonymising write past the items guard
--
-- ON DELETE SET NULL is an internal UPDATE, and it fires BEFORE UPDATE triggers
-- like any other. …0005 §3 declared created_by_id immutable, so without this
-- the guard would abort every account deletion with "items.id, home_id,
-- created_by_id and created_at are immutable".
--
-- The column stays immutable in the sense that matters -- it can be cleared,
-- never re-pointed at a different person, so authorship cannot be forged or
-- transferred. Recreated in full rather than patched, keeping the whole guard
-- readable in one place (it also carries the soft-delete clause added in
-- …20260823000001 §4).
-- ============================================================

create or replace function public.guard_item_derived_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.home_id is distinct from old.home_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'items.id, home_id and created_at are immutable';
  end if;

  -- created_by_id may only ever be cleared, which is what account deletion
  -- does. Re-pointing it at another user would forge authorship.
  if new.created_by_id is distinct from old.created_by_id
     and new.created_by_id is not null
  then
    raise exception 'items.created_by_id can be cleared but not reassigned';
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
-- 3. delete_own_account()
--
-- SECURITY DEFINER because auth.users is not writable by `authenticated`.
-- Takes no arguments and reads the subject from auth.uid(), so it can only ever
-- delete the caller -- there is no id to pass and therefore none to tamper with.
-- ============================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_blocking_homes text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- A home must always have at least one owner (…0004). Deleting this account
  -- cascades its user_homes rows, which would trip enforce_last_owner and abort
  -- the whole transaction with "Cannot remove the last owner of a home" -- true
  -- but useless, since it names no home and suggests no fix.
  --
  -- Refused up front instead, naming the homes and the way out, per §5.1's rule
  -- that refusals are pre-emptive rather than attempted-then-failed. Resolving
  -- it is deliberately left to the user: transfer_ownership and delete_home
  -- (…0003) already exist and the choice between them is theirs, not ours to
  -- guess.
  select string_agg(h.name, ', ' order by h.name)
  into v_blocking_homes
  from public.user_homes uh
  join public.homes h on h.id = uh.home_id
  where uh.user_id = v_user_id
    and uh.role = 'owner'
    and not exists (
      select 1
      from public.user_homes other
      where other.home_id = uh.home_id
        and other.role = 'owner'
        and other.user_id <> v_user_id
    );

  if v_blocking_homes is not null then
    raise exception
      'You are the only owner of: %. Transfer ownership or delete these homes before deleting your account.',
      v_blocking_homes;
  end if;

  -- Everything else follows from the schema: user_homes, notifications and
  -- device_tokens cascade away; homes.created_by_id, items.created_by_id and
  -- inventory_transactions.user_id null out via section 1.
  delete from auth.users where id = v_user_id;
end;
$$;

revoke execute on function public.delete_own_account from public;
grant execute on function public.delete_own_account to authenticated;

commit;
