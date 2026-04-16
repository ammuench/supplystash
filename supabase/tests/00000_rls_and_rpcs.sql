-- pgTAP tests for Supply Stash RLS, RPCs, and triggers
-- Run with: supabase test db

begin;

select plan(32);

-- ============================================================
-- Setup: create test users via Supabase auth helpers
-- ============================================================

select tests.create_supabase_user('owner_user', 'owner@supplystash.app');
select tests.create_supabase_user('admin_user', 'admin@supplystash.app');
select tests.create_supabase_user('member_user', 'member@supplystash.app');
select tests.create_supabase_user('contrib_user', 'contrib@supplystash.app');
select tests.create_supabase_user('viewer_user', 'viewer@supplystash.app');
select tests.create_supabase_user('outsider_user', 'outsider@supplystash.app');

-- ============================================================
-- Test: create_home RPC
-- ============================================================

-- authenticate_as sets auth.uid() to this user for all subsequent queries
select tests.authenticate_as('owner_user');

-- isnt(got, expected, label) — assert got != expected
-- Here: assert create_home returns something (not null = it worked)
select isnt(
  public.create_home('Test Home', 'A home for testing'),
  null,
  'create_home returns a home id'
);

-- Store the home_id in a temp table so every test below can reference it
create temp table test_state (home_id uuid);
insert into test_state
select public.create_home('Main Home', 'The main test home');

-- is(got, expected, label) — assert got = expected
-- Verify the caller was automatically made owner
select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('owner_user')
     and home_id = (select home_id from test_state)),
  'owner',
  'Home creator is assigned owner role'
);

-- ============================================================
-- Test: invite_member RPC (as owner)
-- Still authenticated as owner_user from above.
-- lives_ok(sql, label) — assert the SQL runs without throwing
-- format('...%L...', val) — safe string interpolation for SQL
-- ============================================================

select lives_ok(
  format(
    'select public.invite_member(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('admin_user'),
    'admin'
  ),
  'Owner can invite an admin'
);

select lives_ok(
  format(
    'select public.invite_member(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('member_user'),
    'member'
  ),
  'Owner can invite a member'
);

select lives_ok(
  format(
    'select public.invite_member(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('contrib_user'),
    'contributor'
  ),
  'Owner can invite a contributor'
);

select lives_ok(
  format(
    'select public.invite_member(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('viewer_user'),
    'viewer'
  ),
  'Owner can invite a viewer'
);

-- ============================================================
-- Test: RLS on homes — who can see the home?
-- We switch identities with authenticate_as before each check.
-- ============================================================

-- Owner can see it (still authenticated as owner_user)
select is(
  (select count(*)::integer from public.homes
   where id = (select home_id from test_state)),
  1,
  'Owner can see their home'
);

-- Viewer is a member, so they can see it too
select tests.authenticate_as('viewer_user');

select is(
  (select count(*)::integer from public.homes
   where id = (select home_id from test_state)),
  1,
  'Viewer can see the home they belong to'
);

-- Outsider was never invited — RLS hides the row entirely
select tests.authenticate_as('outsider_user');

select is(
  (select count(*)::integer from public.homes
   where id = (select home_id from test_state)),
  0,
  'Outsider cannot see the home'
);

-- ============================================================
-- Test: homes direct writes are blocked
-- Even the owner can't bypass RPCs — the RLS policy is
-- with check (false) on insert/update/delete.
-- throws_ok(sql, errcode, errmsg, label) — assert SQL throws
-- Pass null for errcode/errmsg to match any error.
-- ============================================================

select tests.authenticate_as('owner_user');

select throws_ok(
  format(
    'insert into public.homes (name, created_by_id) values (%L, %L)',
    'Sneaky Home',
    tests.get_supabase_uid('owner_user')
  ),
  null,
  null,
  'Direct insert into homes is blocked'
);

-- ============================================================
-- Test: items RLS by role
-- Owner inserts an item, then we check each role's access.
-- ============================================================

-- Owner creates an item (member+ can insert via RLS)
select tests.authenticate_as('owner_user');

insert into public.items (home_id, title, current_inventory, warning_amount, created_by_id)
values (
  (select home_id from test_state),
  'Paper Towels',
  5,
  2,
  tests.get_supabase_uid('owner_user')
);

select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from test_state)),
  1,
  'Owner can insert items'
);

-- Member can insert items
select tests.authenticate_as('member_user');

insert into public.items (home_id, title, current_inventory, warning_amount, created_by_id)
values (
  (select home_id from test_state),
  'Dish Soap',
  3,
  1,
  tests.get_supabase_uid('member_user')
);

select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from test_state)),
  2,
  'Member can insert items'
);

-- Member can update items
select lives_ok(
  format(
    'update public.items set current_inventory = 4 where title = %L and home_id = %L',
    'Dish Soap',
    (select home_id from test_state)
  ),
  'Member can update items'
);

-- Member can delete items (delete only the one they added)
select is(
  (select count(*)::integer from (
    delete from public.items
    where title = 'Dish Soap'
      and home_id = (select home_id from test_state)
    returning id
  ) as deleted),
  1,
  'Member can delete items'
);

-- Viewer can READ items
select tests.authenticate_as('viewer_user');

select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from test_state)),
  1,
  'Viewer can read items'
);

-- Viewer CANNOT insert items
select throws_ok(
  format(
    'insert into public.items (home_id, title, current_inventory, warning_amount, created_by_id) values (%L, %L, 1, 1, %L)',
    (select home_id from test_state),
    'Sneaky Item',
    tests.get_supabase_uid('viewer_user')
  ),
  null,
  null,
  'Viewer cannot insert items'
);

-- Contributor can UPDATE items (the +/- counts use case)
select tests.authenticate_as('contrib_user');

select lives_ok(
  format(
    'update public.items set current_inventory = 10 where home_id = %L',
    (select home_id from test_state)
  ),
  'Contributor can update items'
);

-- Contributor CANNOT insert items
select throws_ok(
  format(
    'insert into public.items (home_id, title, current_inventory, warning_amount, created_by_id) values (%L, %L, 1, 1, %L)',
    (select home_id from test_state),
    'Another Item',
    tests.get_supabase_uid('contrib_user')
  ),
  null,
  null,
  'Contributor cannot insert items'
);

-- Contributor CANNOT delete items
-- DELETE with RLS returns 0 rows instead of throwing, so we
-- count the returned rows to verify nothing was deleted.
select is(
  (select count(*)::integer from (
    delete from public.items
    where home_id = (select home_id from test_state)
    returning id
  ) as deleted),
  0,
  'Contributor cannot delete items'
);

-- Outsider cannot see items at all
select tests.authenticate_as('outsider_user');

select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from test_state)),
  0,
  'Outsider cannot see items'
);

-- ============================================================
-- Test: inventory_transactions (ledger) — append-only
-- contributor+ can insert, viewer cannot, nobody can update/delete
-- ============================================================

select tests.authenticate_as('contrib_user');

-- Contributor can log a transaction (the Costco aisle use case)
insert into public.inventory_transactions (item_id, user_id, quantity_changed, transaction_type)
select
  (select id from public.items where title = 'Paper Towels' limit 1),
  tests.get_supabase_uid('contrib_user'),
  -1,
  'consume';

select is(
  (select count(*)::integer from public.inventory_transactions
   where user_id = tests.get_supabase_uid('contrib_user')),
  1,
  'Contributor can insert transactions'
);

-- Viewer cannot insert transactions
select tests.authenticate_as('viewer_user');

select throws_ok(
  format(
    'insert into public.inventory_transactions (item_id, user_id, quantity_changed, transaction_type) values (%L, %L, -1, %L)',
    (select id from public.items where title = 'Paper Towels' limit 1),
    tests.get_supabase_uid('viewer_user'),
    'consume'
  ),
  null,
  null,
  'Viewer cannot insert transactions'
);

-- ============================================================
-- Test: admin restrictions
-- Admins have broad power but cannot touch the owner.
-- ============================================================

select tests.authenticate_as('admin_user');

-- Admin cannot invite someone as owner
select throws_ok(
  format(
    'select public.invite_member(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('outsider_user'),
    'owner'
  ),
  null,
  'Admins cannot invite someone to be an owner',
  'Admin cannot invite as owner'
);

-- Admin cannot demote the owner
select throws_ok(
  format(
    'select public.update_member_role(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('owner_user'),
    'member'
  ),
  null,
  'Admins cannot modify the owner',
  'Admin cannot demote owner'
);

-- Admin cannot remove the owner
select throws_ok(
  format(
    'select public.remove_member(%L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('owner_user')
  ),
  null,
  'Admins cannot remove the owner',
  'Admin cannot remove owner'
);

-- ============================================================
-- Test: outsider cannot use RPCs on a home
-- They're authenticated but not a member — RPCs should reject.
-- ============================================================

select tests.authenticate_as('outsider_user');

select throws_ok(
  format(
    'select public.invite_member(%L, %L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('outsider_user'),
    'member'
  ),
  null,
  'Only owners and admins can invite members',
  'Outsider cannot invite members'
);

select throws_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from test_state),
    'Hacked Name'
  ),
  null,
  'Not a member of this home',
  'Outsider cannot update home'
);

-- ============================================================
-- Test: last-owner trigger
-- The owner can't leave (RPC blocks it), and even raw SQL
-- can't demote or delete the last owner (trigger blocks it).
-- ============================================================

select tests.authenticate_as('owner_user');

-- RPC blocks owner from leaving
select throws_ok(
  format(
    'select public.leave_home(%L)',
    (select home_id from test_state)
  ),
  null,
  'Owner cannot leave. Transfer ownership first.',
  'Owner cannot leave without transferring'
);

-- Switch to service_role to bypass RLS and test the trigger directly.
-- This simulates "what if someone ran raw SQL against the DB?"
select tests.authenticate_as_service_role();

select throws_ok(
  format(
    'update public.user_homes set role = %L where user_id = %L and home_id = %L',
    'member',
    tests.get_supabase_uid('owner_user'),
    (select home_id from test_state)
  ),
  null,
  'Cannot demote the last owner of a home',
  'Trigger prevents demoting the last owner'
);

select throws_ok(
  format(
    'delete from public.user_homes where user_id = %L and home_id = %L',
    tests.get_supabase_uid('owner_user'),
    (select home_id from test_state)
  ),
  null,
  'Cannot remove the last owner of a home',
  'Trigger prevents deleting the last owner'
);

-- ============================================================
-- Test: transfer_ownership
-- Owner transfers to admin, then we verify roles swapped.
-- ============================================================

select tests.authenticate_as('owner_user');

select lives_ok(
  format(
    'select public.transfer_ownership(%L, %L)',
    (select home_id from test_state),
    tests.get_supabase_uid('admin_user')
  ),
  'Owner can transfer ownership'
);

-- Admin is now owner
select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('admin_user')
     and home_id = (select home_id from test_state)),
  'owner',
  'Target is now owner after transfer'
);

-- Previous owner is now admin
select is(
  (select role from public.user_homes
   where user_id = tests.get_supabase_uid('owner_user')
     and home_id = (select home_id from test_state)),
  'admin',
  'Previous owner is now admin after transfer'
);

select * from finish();
rollback;
