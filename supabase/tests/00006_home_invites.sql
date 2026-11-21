-- pgTAP tests for share-link invites (STASH-54): the home_invites table,
-- its RLS, and the create_invite / accept_invite / revoke_invite RPCs.
--
-- Run with: supabase test db

begin;

select plan(10);

-- ============================================================
-- Setup: one home with every role, plus an outsider
-- ============================================================

select tests.create_supabase_user('owner_user', 'owner@supplystash.app');
select tests.create_supabase_user('admin_user', 'admin@supplystash.app');
select tests.create_supabase_user('member_user', 'member@supplystash.app');
select tests.create_supabase_user('viewer_user', 'viewer@supplystash.app');
select tests.create_supabase_user('outsider_user', 'outsider@supplystash.app');

select tests.authenticate_as('owner_user');

create temp table fixtures (label text primary key, id uuid);

-- Temp tables belong to the session user. Reads after a role switch, and the
-- service_role seed below, need these grants.
grant select, insert on fixtures to authenticated, anon, service_role;

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

select * from finish();
rollback;
