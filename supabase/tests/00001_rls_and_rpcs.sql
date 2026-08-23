-- pgTAP tests for Supply Stash RLS, RPCs, and triggers
-- Run with: supabase test db

begin;

select plan(44);

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

-- Temp tables are owned by the session user, but the tests below read them
-- after switching role to authenticated/anon/service_role. Without these
-- grants the first read after a role switch fails with "permission denied".
grant select on test_state to authenticated, anon, service_role;
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

insert into public.items (home_id, title, warning_amount, created_by_id)
values (
  (select home_id from test_state),
  'Paper Towels',
  2,
  tests.get_supabase_uid('owner_user')
);

-- Opening count comes from a ledger row, not from the insert.
insert into public.inventory_transactions (item_id, user_id, quantity_changed, transaction_type)
values (
  (select id from public.items where title = 'Paper Towels' limit 1),
  tests.get_supabase_uid('owner_user'),
  5,
  'manual_add'
);

select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from test_state)),
  1,
  'Owner can insert items'
);

-- Member can insert items
select tests.authenticate_as('member_user');

insert into public.items (home_id, title, warning_amount, created_by_id)
values (
  (select home_id from test_state),
  'Dish Soap',
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
    'update public.items set warning_amount = 4 where title = %L and home_id = %L',
    'Dish Soap',
    (select home_id from test_state)
  ),
  'Member can update items'
);

-- Member can delete items. Deletion is a soft delete since
-- 20260823000001_soft_delete_bank: the DELETE policy is gone and the row is
-- flagged instead, so the ledger hanging off it survives.
create temp table member_deleted_items as
with d as (
  update public.items
  set deleted = true
  where title = 'Dish Soap'
    and home_id = (select home_id from test_state)
  returning id
)
select id from d;

grant select on member_deleted_items to authenticated, anon, service_role;

select is(
  (select count(*)::integer from member_deleted_items),
  1,
  'Member can soft-delete items'
);

-- Viewer can READ items
select tests.authenticate_as('viewer_user');

-- Filtered on deleted = false, exactly as the state/ hooks query (doc §5.3):
-- the soft-deleted 'Dish Soap' row is still physically present and RLS-visible,
-- it is simply excluded from the live list.
select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from test_state)
     and deleted = false),
  1,
  'Viewer can read items'
);

-- Viewer CANNOT insert items
select throws_ok(
  format(
    'insert into public.items (home_id, title, warning_amount, created_by_id) values (%L, %L, 1, %L)',
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
    'update public.items set warning_amount = 10 where home_id = %L',
    (select home_id from test_state)
  ),
  'Contributor can update items'
);

-- Contributor CANNOT insert items
select throws_ok(
  format(
    'insert into public.items (home_id, title, warning_amount, created_by_id) values (%L, %L, 1, %L)',
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
create temp table contrib_deleted_items as
with d as (
  delete from public.items
  where home_id = (select home_id from test_state)
  returning id
)
select id from d;

grant select on contrib_deleted_items to authenticated, anon, service_role;

select is(
  (select count(*)::integer from contrib_deleted_items),
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

-- ============================================================
-- Test: notifications UPDATE cannot reassign ownership
-- The UPDATE policy's USING clause decides which rows you may touch;
-- WITH CHECK decides what the row is allowed to look like afterward.
-- Without WITH CHECK a user could hand their own row to someone else.
-- ============================================================

select tests.authenticate_as_service_role();

insert into public.notifications (user_id, home_id, message, type)
values (
  tests.get_supabase_uid('member_user'),
  (select home_id from test_state),
  'Paper Towels are running low',
  'low_stock'
);

select tests.authenticate_as('member_user');

-- The legitimate update still works — guards against WITH CHECK being too strict
select lives_ok(
  $$update public.notifications set is_read = true where message = 'Paper Towels are running low'$$,
  'Member can mark their own notification read'
);

-- A WITH CHECK violation RAISES (42501), unlike a USING clause, which
-- filters rows away silently. So assert on the error, not on a row count.
select throws_ok(
  format(
    $$update public.notifications set user_id = %L where message = 'Paper Towels are running low'$$,
    tests.get_supabase_uid('outsider_user')
  ),
  '42501',
  'new row violates row-level security policy for table "notifications"',
  'Member cannot reassign their notification to another user'
);

-- ============================================================
-- Test: current_inventory is derived, not written
-- Migration 20260415000005 revoked the column from `authenticated`
-- and added a guard trigger for the paths privileges miss.
-- Paper Towels ledger so far: +5 (owner, manual_add), -1 (contrib, consume).
-- ============================================================

select tests.authenticate_as('contrib_user');

select is(
  (select current_inventory from public.items where title = 'Paper Towels'),
  (select coalesce(sum(quantity_changed), 0)::integer
   from public.inventory_transactions
   where item_id = (select id from public.items where title = 'Paper Towels')),
  'current_inventory equals the ledger sum'
);

-- A client UPDATE of the column is refused at the privilege layer
select throws_ok(
  format(
    'update public.items set current_inventory = 99 where title = %L',
    'Paper Towels'
  ),
  '42501',
  null,
  'Client cannot UPDATE current_inventory'
);

-- ...and so is seeding it at INSERT time
select throws_ok(
  format(
    'insert into public.items (home_id, title, current_inventory, warning_amount, created_by_id) values (%L, %L, 7, 1, %L)',
    (select home_id from test_state),
    'Seeded Item',
    tests.get_supabase_uid('contrib_user')
  ),
  '42501',
  null,
  'Client cannot INSERT current_inventory'
);

-- service_role bypasses RLS and column privileges — the guard trigger
-- is what stops it. The write succeeds but the value does not move.
select tests.authenticate_as_service_role();

select lives_ok(
  format(
    'update public.items set current_inventory = 99 where title = %L',
    'Paper Towels'
  ),
  'service_role UPDATE of current_inventory does not error'
);

select is(
  (select current_inventory from public.items where title = 'Paper Towels'),
  4,
  'Guard trigger neutralizes a service_role write to current_inventory'
);

-- Identity columns are immutable even for service_role
select throws_ok(
  format(
    'update public.items set home_id = %L where title = %L',
    gen_random_uuid(),
    'Paper Towels'
  ),
  'items.id, home_id and created_at are immutable',
  'Guard trigger rejects a home_id change'
);

-- ============================================================
-- Test: the cache trigger fires on UPDATE and DELETE, not just INSERT
-- ============================================================

-- Correcting a ledger row recomputes the cache: -1 becomes -3, so 5-3=2
update public.inventory_transactions
set quantity_changed = -3
where item_id = (select id from public.items where title = 'Paper Towels')
  and quantity_changed = -1;

select is(
  (select current_inventory from public.items where title = 'Paper Towels'),
  2,
  'Cache recomputes when a ledger row is UPDATEd'
);

-- Removing that correction leaves only the +5 opening row
delete from public.inventory_transactions
where item_id = (select id from public.items where title = 'Paper Towels')
  and quantity_changed = -3;

select is(
  (select current_inventory from public.items where title = 'Paper Towels'),
  5,
  'Cache recomputes when a ledger row is DELETEd'
);

-- ============================================================
-- Test: set_updated_at fires on metadata edits  (doc §5.2)
-- ============================================================

-- Two obstacles to testing this in-transaction:
--   now() is the transaction timestamp, so it never advances between
--   statements -- the row has to be backdated to have anything to compare.
--   But set_updated_at is a BEFORE UPDATE trigger, so an ordinary backdate
--   is immediately overwritten by the trigger itself.
-- Drop to the session superuser and turn triggers off for the one statement.
reset role;
set local session_replication_role = replica;

update public.items
set updated_at = now() - interval '1 day'
where title = 'Paper Towels';

set local session_replication_role = origin;

create temp table updated_at_probe (before_ts timestamptz);

grant select on updated_at_probe to authenticated, anon, service_role;

insert into updated_at_probe
select updated_at from public.items where title = 'Paper Towels';

select tests.authenticate_as('contrib_user');

update public.items
set description = 'Now with more absorbency'
where title = 'Paper Towels';

select ok(
  (select i.updated_at from public.items i where i.title = 'Paper Towels')
    > (select before_ts from updated_at_probe),
  'Editing item metadata bumps updated_at'
);

select * from finish();
rollback;
