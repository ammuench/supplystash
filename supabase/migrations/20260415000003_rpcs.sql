-- Supply Stash — SECURITY DEFINER RPCs for home/membership management
-- These are the ONLY write path for homes and user_homes tables.
-- All run as online-only operations (not synced via PowerSync).

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- create_home(name, description)
-- Creates a home and adds the caller as owner.
-- ============================================================

create or replace function public.create_home(
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_home_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Home name is required';
  end if;

  insert into public.homes (name, description, created_by_id)
  values (trim(p_name), p_description, v_user_id)
  returning id into v_home_id;

  insert into public.user_homes (user_id, home_id, role)
  values (v_user_id, v_home_id, 'owner');

  return v_home_id;
end;
$$;

-- ============================================================
-- update_home(home_id, name, description)
-- Only owners and admins can update home metadata.
-- ============================================================

create or replace function public.update_home(
  p_home_id uuid,
  p_name text default null,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_role is null then
    raise exception 'Not a member of this home';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can update home details';
  end if;

  update public.homes
  set
    name = coalesce(trim(p_name), name),
    description = coalesce(p_description, description),
    updated_at = now()
  where id = p_home_id;
end;
$$;

-- ============================================================
-- delete_home(home_id)
-- Only the owner can delete a home.
-- ============================================================

create or replace function public.delete_home(
  p_home_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_role is null or v_role != 'owner' then
    raise exception 'Only the owner can delete a home';
  end if;

  delete from public.homes where id = p_home_id;
end;
$$;

-- ============================================================
-- invite_member(home_id, invitee_user_id, role)
-- Only owners and admins can invite.
-- Admins cannot invite someone to be an owner.
-- ============================================================

create or replace function public.invite_member(
  p_home_id uuid,
  p_invitee_user_id uuid,
  p_role text default 'member'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_caller_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_role not in ('owner', 'admin', 'member', 'contributor', 'viewer') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select role into v_caller_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite members';
  end if;

  if v_caller_role = 'admin' and p_role = 'owner' then
    raise exception 'Admins cannot invite someone to be an owner';
  end if;

  insert into public.user_homes (user_id, home_id, role)
  values (p_invitee_user_id, p_home_id, p_role)
  on conflict (user_id, home_id) do nothing;
end;
$$;

-- ============================================================
-- update_member_role(home_id, target_user_id, new_role)
-- Owners can set any role. Admins cannot modify owners.
-- ============================================================

create or replace function public.update_member_role(
  p_home_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_role not in ('owner', 'admin', 'member', 'contributor', 'viewer') then
    raise exception 'Invalid role: %', p_new_role;
  end if;

  select role into v_caller_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can change roles';
  end if;

  select role into v_target_role
  from public.user_homes
  where user_id = p_target_user_id and home_id = p_home_id;

  if v_target_role is null then
    raise exception 'Target user is not a member of this home';
  end if;

  if v_caller_role = 'admin' and v_target_role = 'owner' then
    raise exception 'Admins cannot modify the owner';
  end if;

  if v_caller_role = 'admin' and p_new_role = 'owner' then
    raise exception 'Admins cannot promote to owner';
  end if;

  update public.user_homes
  set role = p_new_role
  where user_id = p_target_user_id and home_id = p_home_id;
end;
$$;

-- ============================================================
-- remove_member(home_id, target_user_id)
-- Owners can remove anyone. Admins can remove non-owners.
-- ============================================================

create or replace function public.remove_member(
  p_home_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_caller_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can remove members';
  end if;

  select role into v_target_role
  from public.user_homes
  where user_id = p_target_user_id and home_id = p_home_id;

  if v_target_role is null then
    raise exception 'Target user is not a member of this home';
  end if;

  if v_caller_role = 'admin' and v_target_role = 'owner' then
    raise exception 'Admins cannot remove the owner';
  end if;

  delete from public.user_homes
  where user_id = p_target_user_id and home_id = p_home_id;
end;
$$;

-- ============================================================
-- transfer_ownership(home_id, new_owner_user_id)
-- Only the current owner can transfer. Atomically swaps roles.
-- ============================================================

create or replace function public.transfer_ownership(
  p_home_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_caller_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_caller_role is null or v_caller_role != 'owner' then
    raise exception 'Only the owner can transfer ownership';
  end if;

  select role into v_target_role
  from public.user_homes
  where user_id = p_new_owner_user_id and home_id = p_home_id;

  if v_target_role is null then
    raise exception 'Target user is not a member of this home';
  end if;

  -- Promote target to owner
  update public.user_homes
  set role = 'owner'
  where user_id = p_new_owner_user_id and home_id = p_home_id;

  -- Demote caller to admin
  update public.user_homes
  set role = 'admin'
  where user_id = v_user_id and home_id = p_home_id;
end;
$$;

-- ============================================================
-- leave_home(home_id)
-- Any member can leave. Owners cannot leave (must transfer first).
-- ============================================================

create or replace function public.leave_home(
  p_home_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;

  if v_role is null then
    raise exception 'Not a member of this home';
  end if;

  if v_role = 'owner' then
    raise exception 'Owner cannot leave. Transfer ownership first.';
  end if;

  delete from public.user_homes
  where user_id = v_user_id and home_id = p_home_id;
end;
$$;

-- ============================================================
-- Grant execution to authenticated users only
-- ============================================================

revoke execute on function public.create_home from public;
revoke execute on function public.update_home from public;
revoke execute on function public.delete_home from public;
revoke execute on function public.invite_member from public;
revoke execute on function public.update_member_role from public;
revoke execute on function public.remove_member from public;
revoke execute on function public.transfer_ownership from public;
revoke execute on function public.leave_home from public;

grant execute on function public.create_home to authenticated;
grant execute on function public.update_home to authenticated;
grant execute on function public.delete_home to authenticated;
grant execute on function public.invite_member to authenticated;
grant execute on function public.update_member_role to authenticated;
grant execute on function public.remove_member to authenticated;
grant execute on function public.transfer_ownership to authenticated;
grant execute on function public.leave_home to authenticated;

commit;
