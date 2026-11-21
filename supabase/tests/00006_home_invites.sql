-- pgTAP tests for share-link invites (STASH-54): the home_invites table,
-- its RLS, and the create_invite / accept_invite / revoke_invite RPCs.
--
-- Run with: supabase test db

begin;

select plan(41);

-- ============================================================
-- Setup: one home with every role, plus an outsider
-- ============================================================

select tests.create_supabase_user('owner_user', 'owner@supplystash.app');
select tests.create_supabase_user('admin_user', 'admin@supplystash.app');
select tests.create_supabase_user('member_user', 'member@supplystash.app');
select tests.create_supabase_user('viewer_user', 'viewer@supplystash.app');
select tests.create_supabase_user('outsider_user', 'outsider@supplystash.app');
-- Two people with no home yet, who join through links.
select tests.create_supabase_user('joiner_user', 'joiner@supplystash.app');
select tests.create_supabase_user('second_joiner_user', 'second-joiner@supplystash.app');

select tests.authenticate_as('owner_user');

create temp table fixtures (label text primary key, id uuid);

-- Temp tables belong to the session user. Reads after a role switch, and the
-- service_role seed below, need these grants.
grant select, insert on fixtures to authenticated, anon, service_role;

-- Invites created through create_invite, by label, so later tests can accept
-- or revoke them.
create temp table invites (label text primary key, invite_id uuid, token text);
grant select, insert on invites to authenticated, anon, service_role;

insert into fixtures (label, id)
values ('home', public.create_home('Invite Home', 'invite fixtures'));

select public.invite_member((select id from fixtures where label = 'home'), tests.get_supabase_uid('admin_user'), 'admin');
select public.invite_member((select id from fixtures where label = 'home'), tests.get_supabase_uid('member_user'), 'member');
select public.invite_member((select id from fixtures where label = 'home'), tests.get_supabase_uid('viewer_user'), 'viewer');

-- Seed one invite directly. The RPCs that write invites arrive in the next
-- section; service_role bypasses RLS to set up the read tests.
select tests.authenticate_as_service_role();

with inserted as (
  insert into public.home_invites (home_id, created_by_id)
  values ((select id from fixtures where label = 'home'), tests.get_supabase_uid('owner_user'))
  returning id
)
insert into fixtures (label, id)
select 'seeded_invite', id from inserted;

-- ============================================================
-- RLS: who can read invites
-- ============================================================

select tests.authenticate_as('owner_user');
select is(
  (select count(*)::int from public.home_invites),
  1,
  'Owner can see the home''s invites'
);

select tests.authenticate_as('admin_user');
select is(
  (select count(*)::int from public.home_invites),
  1,
  'Admin can see the home''s invites'
);

select tests.authenticate_as('member_user');
select is_empty(
  'select id from public.home_invites',
  'Member cannot see invite tokens'
);

select tests.authenticate_as('viewer_user');
select is_empty(
  'select id from public.home_invites',
  'Viewer cannot see invite tokens'
);

select tests.authenticate_as('outsider_user');
select is_empty(
  'select id from public.home_invites',
  'Outsider cannot see invite tokens'
);

-- ============================================================
-- RLS: no direct writes, even for the owner
-- ============================================================

select tests.authenticate_as('owner_user');

-- 42501 = insufficient_privilege: the "with check (false)" policy refuses it.
select throws_ok(
  format(
    'insert into public.home_invites (home_id, created_by_id) values (%L, %L)',
    (select id from fixtures where label = 'home'),
    tests.get_supabase_uid('owner_user')
  ),
  '42501',
  null,
  'Owner cannot insert an invite directly'
);

-- An update or delete blocked by "using (false)" matches no rows. It does not
-- raise, so check that the row is unchanged.
update public.home_invites set revoked_at = now();
delete from public.home_invites;

select tests.authenticate_as_service_role();

select is(
  (select revoked_at from public.home_invites where id = (select id from fixtures where label = 'seeded_invite')),
  null,
  'Owner cannot update an invite directly'
);

select is(
  (select count(*)::int from public.home_invites),
  1,
  'Owner cannot delete an invite directly'
);

-- ============================================================
-- Table rules
-- ============================================================

-- 23514 = check_violation. A link can never grant admin or owner.
select throws_ok(
  format(
    'insert into public.home_invites (home_id, created_by_id, role) values (%L, %L, %L)',
    (select id from fixtures where label = 'home'),
    tests.get_supabase_uid('owner_user'),
    'admin'
  ),
  '23514',
  null,
  'An invite cannot grant admin'
);

select throws_ok(
  format(
    'insert into public.home_invites (home_id, created_by_id, role) values (%L, %L, %L)',
    (select id from fixtures where label = 'home'),
    tests.get_supabase_uid('owner_user'),
    'owner'
  ),
  '23514',
  null,
  'An invite cannot grant owner'
);

-- ============================================================
-- Signed-out callers cannot reach the RPCs at all
-- ============================================================

-- Execute is revoked from anon, so a signed-out caller is refused before the
-- function body runs. Ask Postgres for the privilege instead of calling the
-- function: a throws_ok on a denied function call crashes the local server
-- (signal 11) on the current Supabase image.
select ok(
  not has_function_privilege('anon', 'public.create_invite(uuid, text)', 'execute'),
  'A signed-out caller cannot create an invite'
);

select ok(
  not has_function_privilege('anon', 'public.accept_invite(text)', 'execute'),
  'A signed-out caller cannot accept an invite'
);

select ok(
  not has_function_privilege('anon', 'public.revoke_invite(uuid)', 'execute'),
  'A signed-out caller cannot revoke an invite'
);

-- ============================================================
-- create_invite — owners and admins only, member or viewer only
-- ============================================================

select tests.authenticate_as('owner_user');

-- Each create keeps its token in the invites table for the tests below.
insert into invites (label, invite_id, token)
select 'owner_member', invite_id, token
from public.create_invite((select id from fixtures where label = 'home'));

insert into invites (label, invite_id, token)
select 'owner_viewer', invite_id, token
from public.create_invite((select id from fixtures where label = 'home'), 'viewer');

-- Spares for the expired, revoked and already-member cases.
insert into invites (label, invite_id, token)
select 'to_expire', invite_id, token
from public.create_invite((select id from fixtures where label = 'home'));

insert into invites (label, invite_id, token)
select 'to_revoke', invite_id, token
from public.create_invite((select id from fixtures where label = 'home'));

insert into invites (label, invite_id, token)
select 'for_existing_member', invite_id, token
from public.create_invite((select id from fixtures where label = 'home'));

insert into invites (label, invite_id, token)
select 'to_revoke_by_admin', invite_id, token
from public.create_invite((select id from fixtures where label = 'home'));

select tests.authenticate_as_service_role();

select is(
  (select role from public.home_invites where id = (select invite_id from invites where label = 'owner_member')),
  'member',
  'An invite grants member by default'
);

select is(
  (select role from public.home_invites where id = (select invite_id from invites where label = 'owner_viewer')),
  'viewer',
  'An invite can grant viewer'
);

-- Inside one transaction now() does not move, so the default is exact.
select is(
  (select expires_at from public.home_invites where id = (select invite_id from invites where label = 'owner_member')),
  now() + interval '7 days',
  'An invite expires 7 days after it is created'
);

select tests.authenticate_as('admin_user');

select lives_ok(
  format('select * from public.create_invite(%L, %L)', (select id from fixtures where label = 'home'), 'viewer'),
  'Admin can create an invite'
);

select tests.authenticate_as('member_user');

select throws_ok(
  format('select * from public.create_invite(%L)', (select id from fixtures where label = 'home')),
  '42501',
  'Only owners and admins can create invites',
  'Member cannot create an invite'
);

select tests.authenticate_as('viewer_user');

select throws_ok(
  format('select * from public.create_invite(%L)', (select id from fixtures where label = 'home')),
  '42501',
  'Only owners and admins can create invites',
  'Viewer cannot create an invite'
);

select tests.authenticate_as('outsider_user');

select throws_ok(
  format('select * from public.create_invite(%L)', (select id from fixtures where label = 'home')),
  '42501',
  'Only owners and admins can create invites',
  'Outsider cannot create an invite'
);

-- 22023 = invalid_parameter_value. The RPC refuses before the table's check
-- constraint would, with a clearer message.
select tests.authenticate_as('owner_user');

select throws_ok(
  format('select * from public.create_invite(%L, %L)', (select id from fixtures where label = 'home'), 'admin'),
  '22023',
  'Invalid invite role: admin',
  'Owner cannot create an invite that grants admin'
);

-- ============================================================
-- accept_invite — valid token joins with the invite's role
-- ============================================================

select tests.authenticate_as('joiner_user');

select results_eq(
  format('select home_id, already_member from public.accept_invite(%L)', (select token from invites where label = 'owner_member')),
  format('values (%L::uuid, false)', (select id from fixtures where label = 'home')),
  'Accepting a valid invite returns the home and already_member = false'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('joiner_user')
     and home_id = (select id from fixtures where label = 'home')),
  'member',
  'The joiner gets the invite''s role'
);

select tests.authenticate_as_service_role();

select is(
  (select used_by_id from public.home_invites where id = (select invite_id from invites where label = 'owner_member')),
  tests.get_supabase_uid('joiner_user'),
  'Accepting marks the invite used by the joiner'
);

-- Single-use: a second person cannot reuse the link.
select tests.authenticate_as('second_joiner_user');

select throws_ok(
  format('select * from public.accept_invite(%L)', (select token from invites where label = 'owner_member')),
  'P0002',
  'Invite is not valid',
  'A used invite cannot be accepted again'
);

select lives_ok(
  format('select * from public.accept_invite(%L)', (select token from invites where label = 'owner_viewer')),
  'A second person can accept a different invite'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('second_joiner_user')
     and home_id = (select id from fixtures where label = 'home')),
  'viewer',
  'A viewer invite joins the caller as viewer'
);

-- ============================================================
-- accept_invite — unusable tokens all raise P0002
-- ============================================================

-- Backdate as service_role: RLS blocks the update for everyone else.
select tests.authenticate_as_service_role();

update public.home_invites
set expires_at = now() - interval '1 second'
where id = (select invite_id from invites where label = 'to_expire');

select tests.authenticate_as('owner_user');
select public.revoke_invite((select invite_id from invites where label = 'to_revoke'));

select tests.authenticate_as('outsider_user');

select throws_ok(
  format('select * from public.accept_invite(%L)', (select token from invites where label = 'to_expire')),
  'P0002',
  'Invite is not valid',
  'An expired invite cannot be accepted'
);

select throws_ok(
  format('select * from public.accept_invite(%L)', (select token from invites where label = 'to_revoke')),
  'P0002',
  'Invite is not valid',
  'A revoked invite cannot be accepted'
);

select throws_ok(
  'select * from public.accept_invite(''not-a-real-token'')',
  'P0002',
  'Invite is not valid',
  'An unknown token cannot be accepted'
);

select is_empty(
  format('select 1 from public.homes where id = %L', (select id from fixtures where label = 'home')),
  'The failed accepts did not let the outsider in'
);

-- ============================================================
-- accept_invite — caller is already a member
-- ============================================================

-- A viewer opens a member link: no promotion, and the link stays usable.
select tests.authenticate_as('viewer_user');

select results_eq(
  format('select home_id, already_member from public.accept_invite(%L)', (select token from invites where label = 'for_existing_member')),
  format('values (%L::uuid, true)', (select id from fixtures where label = 'home')),
  'An existing member gets the home and already_member = true'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('viewer_user')
     and home_id = (select id from fixtures where label = 'home')),
  'viewer',
  'An existing member keeps their role'
);

select tests.authenticate_as_service_role();

select is(
  (select used_at from public.home_invites where id = (select invite_id from invites where label = 'for_existing_member')),
  null,
  'An existing member does not use up the invite'
);

-- ============================================================
-- revoke_invite — owners and admins only
-- ============================================================

select tests.authenticate_as('member_user');

select throws_ok(
  format('select public.revoke_invite(%L)', (select invite_id from invites where label = 'for_existing_member')),
  '42501',
  'Only owners and admins can revoke invites',
  'Member cannot revoke an invite'
);

select tests.authenticate_as('outsider_user');

select throws_ok(
  format('select public.revoke_invite(%L)', (select invite_id from invites where label = 'for_existing_member')),
  '42501',
  'Only owners and admins can revoke invites',
  'Outsider cannot revoke an invite'
);

-- Same error as "not allowed", so a caller cannot probe which ids exist.
select tests.authenticate_as('owner_user');

select throws_ok(
  format('select public.revoke_invite(%L)', gen_random_uuid()),
  '42501',
  'Only owners and admins can revoke invites',
  'Revoking an unknown invite raises the same error as not being allowed'
);

select tests.authenticate_as('admin_user');

select lives_ok(
  format('select public.revoke_invite(%L)', (select invite_id from invites where label = 'to_revoke_by_admin')),
  'Admin can revoke an invite'
);

select tests.authenticate_as_service_role();

select isnt(
  (select revoked_at from public.home_invites where id = (select invite_id from invites where label = 'to_revoke_by_admin')),
  null,
  'Revoking sets revoked_at'
);

-- A used invite is history; revoking it changes nothing.
select tests.authenticate_as('owner_user');

select lives_ok(
  format('select public.revoke_invite(%L)', (select invite_id from invites where label = 'owner_member')),
  'Revoking a used invite does not raise'
);

select tests.authenticate_as_service_role();

select is(
  (select revoked_at from public.home_invites where id = (select invite_id from invites where label = 'owner_member')),
  null,
  'Revoking a used invite leaves it unrevoked'
);

select * from finish();
rollback;
