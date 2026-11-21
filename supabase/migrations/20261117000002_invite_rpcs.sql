-- Supply Stash — share-link invite RPCs (STASH-54)
--
-- create_invite, accept_invite and revoke_invite are the only way to write
-- public.home_invites (…20261117000001): its RLS refuses every direct write.
--
-- SECURITY DEFINER runs each function as its owner, which bypasses RLS. That
-- is what lets accept_invite insert into user_homes for someone who is not a
-- member yet. So every function checks the caller itself, first thing.
--
-- Error codes the client branches on (lib/postgrest-error.ts):
--   42501  caller may not do this (also an unknown invite id, so revoke_invite
--          does not reveal which ids exist)
--   22023  create_invite got a role other than member or viewer
--   P0002  accept_invite got a token that is unknown, expired, used or
--          revoked. One code for all four: the user's next step is the same,
--          ask for a new link.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- create_invite(home_id, role) — owners and admins only
-- ============================================================

create or replace function public.create_invite(
  p_home_id uuid,
  p_role text default 'member'
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
-- The output columns share names with home_invites columns. Resolve to the
-- table column, not the output variable.
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_home_admin_or_above(p_home_id) then
    raise exception 'Only owners and admins can create invites'
      using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('member', 'viewer') then
    raise exception 'Invalid invite role: %', p_role
      using errcode = '22023';
  end if;

  return query
  insert into public.home_invites as i (home_id, role, created_by_id)
  values (p_home_id, p_role, v_user_id)
  returning i.id, i.token, i.expires_at;
end;
$$;

-- ============================================================
-- accept_invite(token) — any signed-in user holding a valid token
-- ============================================================

create or replace function public.accept_invite(p_token text)
returns table (home_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_invite public.home_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- FOR UPDATE locks the row until this transaction ends. If two people accept
  -- the same link at once, the second waits, then sees used_at set and fails.
  select * into v_invite
  from public.home_invites
  where token = p_token
  for update;

  if not found
    or v_invite.used_at is not null
    or v_invite.revoked_at is not null
    or v_invite.expires_at <= now()
  then
    raise exception 'Invite is not valid'
      using errcode = 'P0002';
  end if;

  -- Already in the home: report it and leave the link unused, so the person it
  -- was meant for can still use it. The caller's role is not changed.
  if exists (
    select 1 from public.user_homes uh
    where uh.user_id = v_user_id and uh.home_id = v_invite.home_id
  ) then
    return query select v_invite.home_id, true;
    return;
  end if;

  insert into public.user_homes (user_id, home_id, role)
  values (v_user_id, v_invite.home_id, v_invite.role);

  update public.home_invites
  set used_at = now(), used_by_id = v_user_id
  where id = v_invite.id;

  return query select v_invite.home_id, false;
end;
$$;

-- ============================================================
-- revoke_invite(invite_id) — owners and admins of the invite's home
-- ============================================================

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
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

  select home_id into v_home_id
  from public.home_invites
  where id = p_invite_id;

  if v_home_id is null or not public.is_home_admin_or_above(v_home_id) then
    raise exception 'Only owners and admins can revoke invites'
      using errcode = '42501';
  end if;

  -- A used or already revoked invite is left as it is: nothing to stop.
  update public.home_invites
  set revoked_at = now()
  where id = p_invite_id
    and used_at is null
    and revoked_at is null;
end;
$$;

-- Supabase grants execute on new functions to anon directly, so revoking from
-- public alone would leave signed-out callers able to reach them.
revoke execute on function public.create_invite from public, anon;
revoke execute on function public.accept_invite from public, anon;
revoke execute on function public.revoke_invite from public, anon;

grant execute on function public.create_invite to authenticated;
grant execute on function public.accept_invite to authenticated;
grant execute on function public.revoke_invite to authenticated;

commit;
