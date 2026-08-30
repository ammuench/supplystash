-- Supply Stash — let delete_home actually delete a home
--
-- enforce_last_owner (…0004) protects one invariant: a home always has at least
-- one owner. It fires BEFORE DELETE on user_homes and refuses to remove the last
-- owner row.
--
-- homes -> user_homes is ON DELETE CASCADE, so `delete from public.homes` inside
-- delete_home (…0003) cascades into user_homes and trips that guard on the
-- owner's own membership row. delete_home therefore failed for every home ever
-- created, with "Cannot remove the last owner of a home" -- the one call that is
-- supposed to remove the last owner.
--
-- This was not a narrow break. delete_own_account (…20260823000003 §3) refuses
-- to run while the caller is the sole owner of a home and names delete_home as
-- one of the two ways out. That way out did not exist, so a user who solely
-- owned a home and had nobody to transfer it to could not erase their account
-- at all.
--
-- The invariant is about live homes. Once the home row is gone there is nothing
-- left to own, so the guard has nothing to protect and skipping it preserves the
-- rule rather than weakening it. Postgres deletes the parent row before firing
-- the RI cascade into children, so an absent homes row is exactly the signal
-- that this delete is a cascade and not a membership change.
--
-- Direct removal of a last owner from a home that still exists is unaffected and
-- still raises, as do all the demotion paths -- 00001's trigger tests cover both
-- and are untouched.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

create or replace function public.enforce_last_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_remaining_owners integer;
begin
  -- The home is already gone: this row is being cleaned up by the ON DELETE
  -- CASCADE, not orphaned by a membership change. Nothing to guard.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.homes where id = old.home_id)
  then
    return old;
  end if;

  -- On DELETE: check if we're removing an owner
  if tg_op = 'DELETE' and old.role = 'owner' then
    select count(*) into v_remaining_owners
    from public.user_homes
    where home_id = old.home_id
      and role = 'owner'
      and user_id != old.user_id;

    if v_remaining_owners = 0 then
      raise exception 'Cannot remove the last owner of a home';
    end if;
  end if;

  -- On UPDATE: check if we're demoting an owner
  if tg_op = 'UPDATE' and old.role = 'owner' and new.role != 'owner' then
    select count(*) into v_remaining_owners
    from public.user_homes
    where home_id = old.home_id
      and role = 'owner'
      and user_id != old.user_id;

    if v_remaining_owners = 0 then
      raise exception 'Cannot demote the last owner of a home';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

commit;
