-- Supply Stash — DB-level safety triggers on user_homes
-- Belt-and-suspenders: these enforce invariants even if RPCs are bypassed.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- Last-owner enforcement
-- A home must always have at least one owner.
-- Prevents: deleting the last owner row, or demoting the last owner.
-- ============================================================

create or replace function public.enforce_last_owner()
returns trigger
language plpgsql
as $$
declare
  v_remaining_owners integer;
begin
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

create trigger enforce_last_owner_trigger
before update or delete on public.user_homes
for each row
execute function public.enforce_last_owner();

commit;
