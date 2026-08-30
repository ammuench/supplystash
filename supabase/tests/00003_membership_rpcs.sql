-- pgTAP tests for the membership RPCs that 00001 only touches in passing:
--   update_home, delete_home, update_member_role,
--   remove_member, transfer_ownership, leave_home
--
-- 00001 asserts a handful of these indirectly (an admin cannot demote the
-- owner, an owner cannot leave). This file drives each RPC directly through
-- its happy path and every guard clause in its body.
--
-- Each RPC gets its own home so one section's mutations cannot leak into the
-- next. Homes are labelled 'a' through 'f' in a temp table.
--
-- Run with: supabase test db

begin;

select plan(38);

-- ============================================================
-- Setup: users and one home per RPC under test
-- ============================================================

select tests.create_supabase_user('owner_user', 'owner@supplystash.app');
select tests.create_supabase_user('admin_user', 'admin@supplystash.app');
select tests.create_supabase_user('member_user', 'member@supplystash.app');
select tests.create_supabase_user('viewer_user', 'viewer@supplystash.app');
select tests.create_supabase_user('outsider_user', 'outsider@supplystash.app');

select tests.authenticate_as('owner_user');

create temp table homes_under_test (label text primary key, home_id uuid);

-- Temp tables belong to the session user, but every read below happens after
-- a role switch to authenticated/service_role. Without these grants the first
-- read after the switch fails with "permission denied".
grant select on homes_under_test to authenticated, anon, service_role;

insert into homes_under_test (label, home_id)
values
  ('a', public.create_home('Home A', 'update_home fixtures')),
  ('b', public.create_home('Home B', 'delete_home fixtures')),
  ('c', public.create_home('Home C', 'update_member_role fixtures')),
  ('d', public.create_home('Home D', 'remove_member fixtures')),
  ('e', public.create_home('Home E', 'transfer_ownership fixtures')),
  ('f', public.create_home('Home F', 'leave_home fixtures'));

-- Seed each home with only the roles its section actually exercises.
select public.invite_member((select home_id from homes_under_test where label = 'a'), tests.get_supabase_uid('admin_user'), 'admin');
select public.invite_member((select home_id from homes_under_test where label = 'a'), tests.get_supabase_uid('member_user'), 'member');
select public.invite_member((select home_id from homes_under_test where label = 'a'), tests.get_supabase_uid('viewer_user'), 'viewer');

select public.invite_member((select home_id from homes_under_test where label = 'b'), tests.get_supabase_uid('admin_user'), 'admin');
select public.invite_member((select home_id from homes_under_test where label = 'b'), tests.get_supabase_uid('member_user'), 'member');

select public.invite_member((select home_id from homes_under_test where label = 'c'), tests.get_supabase_uid('admin_user'), 'admin');
select public.invite_member((select home_id from homes_under_test where label = 'c'), tests.get_supabase_uid('member_user'), 'member');
select public.invite_member((select home_id from homes_under_test where label = 'c'), tests.get_supabase_uid('viewer_user'), 'viewer');

select public.invite_member((select home_id from homes_under_test where label = 'd'), tests.get_supabase_uid('admin_user'), 'admin');
select public.invite_member((select home_id from homes_under_test where label = 'd'), tests.get_supabase_uid('member_user'), 'member');
select public.invite_member((select home_id from homes_under_test where label = 'd'), tests.get_supabase_uid('viewer_user'), 'viewer');

select public.invite_member((select home_id from homes_under_test where label = 'e'), tests.get_supabase_uid('admin_user'), 'admin');
select public.invite_member((select home_id from homes_under_test where label = 'e'), tests.get_supabase_uid('member_user'), 'member');

select public.invite_member((select home_id from homes_under_test where label = 'f'), tests.get_supabase_uid('member_user'), 'member');

-- ============================================================
-- update_home — owners and admins only
-- ============================================================

select tests.authenticate_as('owner_user');

select lives_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from homes_under_test where label = 'a'),
    'Renamed by Owner'
  ),
  'Owner can rename a home'
);

select is(
  (select name from public.homes where id = (select home_id from homes_under_test where label = 'a')),
  'Renamed by Owner',
  'update_home persists the new name'
);

-- Admins have the same reach as owners here.
select tests.authenticate_as('admin_user');

select lives_ok(
  format(
    'select public.update_home(%L, null, %L)',
    (select home_id from homes_under_test where label = 'a'),
    'Set by admin'
  ),
  'Admin can update a home'
);

select is(
  (select description from public.homes where id = (select home_id from homes_under_test where label = 'a')),
  'Set by admin',
  'update_home persists the new description'
);

-- update_home coalesces each argument, so a null leaves that column alone.
select is(
  (select name from public.homes where id = (select home_id from homes_under_test where label = 'a')),
  'Renamed by Owner',
  'A description-only update leaves the name untouched'
);

select tests.authenticate_as('member_user');

select throws_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from homes_under_test where label = 'a'),
    'Renamed by Member'
  ),
  null,
  'Only owners and admins can update home details',
  'Member cannot update a home'
);

select tests.authenticate_as('viewer_user');

select throws_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from homes_under_test where label = 'a'),
    'Renamed by Viewer'
  ),
  null,
  'Only owners and admins can update home details',
  'Viewer cannot update a home'
);

-- ============================================================
-- delete_home — the owner alone, and it cascades
-- ============================================================

select tests.authenticate_as('member_user');

select throws_ok(
  format(
    'select public.delete_home(%L)',
    (select home_id from homes_under_test where label = 'b')
  ),
  null,
  'Only the owner can delete a home',
  'Member cannot delete a home'
);

select tests.authenticate_as('admin_user');

select throws_ok(
  format(
    'select public.delete_home(%L)',
    (select home_id from homes_under_test where label = 'b')
  ),
  null,
  'Only the owner can delete a home',
  'Admin cannot delete a home'
);

-- A non-member reads back a null role, which lands on the same guard.
select tests.authenticate_as('outsider_user');

select throws_ok(
  format(
    'select public.delete_home(%L)',
    (select home_id from homes_under_test where label = 'b')
  ),
  null,
  'Only the owner can delete a home',
  'Outsider cannot delete a home'
);

select tests.authenticate_as('owner_user');

select lives_ok(
  format(
    'select public.delete_home(%L)',
    (select home_id from homes_under_test where label = 'b')
  ),
  'Owner can delete a home'
);

-- RLS would hide a surviving row from every test user, so confirm the delete
-- with service_role — that distinguishes "gone" from "merely invisible".
select tests.authenticate_as_service_role();

select is(
  (select count(*)::integer from public.homes
   where id = (select home_id from homes_under_test where label = 'b')),
  0,
  'delete_home removes the home row'
);

select is(
  (select count(*)::integer from public.user_homes
   where home_id = (select home_id from homes_under_test where label = 'b')),
  0,
  'Deleting a home cascades to its memberships'
);

-- ============================================================
-- update_member_role — owners set anything, admins are fenced in
-- ============================================================

select tests.authenticate_as('owner_user');

select lives_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from homes_under_test where label = 'c'),
    tests.get_supabase_uid('member_user'),
    'contributor'
  ),
  'Owner can change a member role'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('member_user')
     and home_id = (select home_id from homes_under_test where label = 'c')),
  'contributor',
  'update_member_role persists the new role'
);

select throws_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from homes_under_test where label = 'c'),
    tests.get_supabase_uid('viewer_user'),
    'superuser'
  ),
  null,
  'Invalid role: superuser',
  'update_member_role rejects an unknown role'
);

select throws_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from homes_under_test where label = 'c'),
    tests.get_supabase_uid('outsider_user'),
    'member'
  ),
  null,
  'Target user is not a member of this home',
  'update_member_role rejects a target outside the home'
);

select tests.authenticate_as('admin_user');

select lives_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from homes_under_test where label = 'c'),
    tests.get_supabase_uid('viewer_user'),
    'member'
  ),
  'Admin can promote a viewer'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('viewer_user')
     and home_id = (select home_id from homes_under_test where label = 'c')),
  'member',
  'Admin promotion persists'
);

-- 00001 covers an admin demoting the owner; this is the other admin ceiling.
select throws_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from homes_under_test where label = 'c'),
    tests.get_supabase_uid('member_user'),
    'owner'
  ),
  null,
  'Admins cannot promote to owner',
  'Admin cannot promote anyone to owner'
);

-- member_user is a contributor in home C as of the first assertion above.
select tests.authenticate_as('member_user');

select throws_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from homes_under_test where label = 'c'),
    tests.get_supabase_uid('viewer_user'),
    'admin'
  ),
  null,
  'Only owners and admins can change roles',
  'Contributor cannot change roles'
);

-- ============================================================
-- remove_member — owners and admins evict, others cannot
-- ============================================================

select tests.authenticate_as('owner_user');

select lives_ok(
  format(
    'select public.remove_member(%L, %L)',
    (select home_id from homes_under_test where label = 'd'),
    tests.get_supabase_uid('viewer_user')
  ),
  'Owner can remove a member'
);

select is(
  (select count(*)::integer from public.user_homes
   where user_id = tests.get_supabase_uid('viewer_user')
     and home_id = (select home_id from homes_under_test where label = 'd')),
  0,
  'remove_member drops the membership row'
);

select tests.authenticate_as('member_user');

select throws_ok(
  format(
    'select public.remove_member(%L, %L)',
    (select home_id from homes_under_test where label = 'd'),
    tests.get_supabase_uid('admin_user')
  ),
  null,
  'Only owners and admins can remove members',
  'Member cannot remove other members'
);

select tests.authenticate_as('admin_user');

select throws_ok(
  format(
    'select public.remove_member(%L, %L)',
    (select home_id from homes_under_test where label = 'd'),
    tests.get_supabase_uid('outsider_user')
  ),
  null,
  'Target user is not a member of this home',
  'remove_member rejects a target outside the home'
);

select lives_ok(
  format(
    'select public.remove_member(%L, %L)',
    (select home_id from homes_under_test where label = 'd'),
    tests.get_supabase_uid('member_user')
  ),
  'Admin can remove a non-owner member'
);

select is(
  (select count(*)::integer from public.user_homes
   where user_id = tests.get_supabase_uid('member_user')
     and home_id = (select home_id from homes_under_test where label = 'd')),
  0,
  'Admin removal drops the membership row'
);

-- ============================================================
-- transfer_ownership — only the sitting owner may hand over
-- ============================================================

select tests.authenticate_as('admin_user');

select throws_ok(
  format(
    'select public.transfer_ownership(%L, %L)',
    (select home_id from homes_under_test where label = 'e'),
    tests.get_supabase_uid('admin_user')
  ),
  null,
  'Only the owner can transfer ownership',
  'Admin cannot transfer ownership to themselves'
);

select tests.authenticate_as('member_user');

select throws_ok(
  format(
    'select public.transfer_ownership(%L, %L)',
    (select home_id from homes_under_test where label = 'e'),
    tests.get_supabase_uid('member_user')
  ),
  null,
  'Only the owner can transfer ownership',
  'Member cannot transfer ownership'
);

select tests.authenticate_as('owner_user');

select throws_ok(
  format(
    'select public.transfer_ownership(%L, %L)',
    (select home_id from homes_under_test where label = 'e'),
    tests.get_supabase_uid('outsider_user')
  ),
  null,
  'Target user is not a member of this home',
  'Ownership cannot be transferred outside the home'
);

select lives_ok(
  format(
    'select public.transfer_ownership(%L, %L)',
    (select home_id from homes_under_test where label = 'e'),
    tests.get_supabase_uid('member_user')
  ),
  'Owner can transfer ownership to a plain member'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('member_user')
     and home_id = (select home_id from homes_under_test where label = 'e')),
  'owner',
  'The target holds owner after the transfer'
);

select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('owner_user')
     and home_id = (select home_id from homes_under_test where label = 'e')),
  'admin',
  'The previous owner is demoted to admin'
);

-- The transfer is what unblocks the exit: the same call that leave_home
-- refuses for an owner now succeeds for the demoted admin.
select lives_ok(
  format(
    'select public.leave_home(%L)',
    (select home_id from homes_under_test where label = 'e')
  ),
  'A demoted owner can leave the home they handed over'
);

-- ============================================================
-- leave_home — anyone but the last owner walks out
-- ============================================================

select tests.authenticate_as('outsider_user');

select throws_ok(
  format(
    'select public.leave_home(%L)',
    (select home_id from homes_under_test where label = 'f')
  ),
  null,
  'Not a member of this home',
  'A non-member cannot leave a home'
);

select tests.authenticate_as('member_user');

select lives_ok(
  format(
    'select public.leave_home(%L)',
    (select home_id from homes_under_test where label = 'f')
  ),
  'Member can leave a home'
);

select tests.authenticate_as('owner_user');

select is(
  (select count(*)::integer from public.user_homes
   where user_id = tests.get_supabase_uid('member_user')
     and home_id = (select home_id from homes_under_test where label = 'f')),
  0,
  'leave_home drops the membership row'
);

select throws_ok(
  format(
    'select public.leave_home(%L)',
    (select home_id from homes_under_test where label = 'f')
  ),
  null,
  'Owner cannot leave. Transfer ownership first.',
  'Owner cannot leave without transferring first'
);

select * from finish();
rollback;
