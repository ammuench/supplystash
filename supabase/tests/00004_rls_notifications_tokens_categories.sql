-- pgTAP tests for RLS on the three tables 00001 barely touches:
--   notifications, device_tokens, item_categories
--
-- notifications and device_tokens are strictly private per user: every policy
-- is `user_id = auth.uid()`. notifications deliberately has NO insert policy —
-- rows are written by the backend, never by a client — so that gap is asserted
-- rather than assumed.
--
-- item_categories has no home_id of its own; it inherits reach from the item
-- it points at, so each policy joins through public.items.
--
-- A note on how RLS refuses things, because the two look different here:
--   * A WITH CHECK violation (insert, or an update that moves a row out of
--     your reach) RAISES 42501.
--   * A USING violation (update/delete of a row you may not touch) silently
--     filters the row away and affects 0 rows.
-- So writes are asserted with throws_ok in the first case and a returned-row
-- count in the second.
--
-- Run with: supabase test db

begin;

select plan(29);

-- ============================================================
-- Setup: users, a home, one item, and two categories
-- ============================================================

select tests.create_supabase_user('owner_user', 'owner@supplystash.app');
select tests.create_supabase_user('member_user', 'member@supplystash.app');
select tests.create_supabase_user('contrib_user', 'contrib@supplystash.app');
select tests.create_supabase_user('viewer_user', 'viewer@supplystash.app');
select tests.create_supabase_user('outsider_user', 'outsider@supplystash.app');

select tests.authenticate_as('owner_user');

create temp table test_state (home_id uuid);

-- Temp tables belong to the session user, but every read below happens after
-- a role switch to authenticated/anon/service_role. Without these grants the
-- first read after the switch fails with "permission denied".
grant select on test_state to authenticated, anon, service_role;

insert into test_state select public.create_home('RLS Home', 'notifications/tokens/categories fixtures');

select public.invite_member((select home_id from test_state), tests.get_supabase_uid('member_user'), 'member');
select public.invite_member((select home_id from test_state), tests.get_supabase_uid('contrib_user'), 'contributor');
select public.invite_member((select home_id from test_state), tests.get_supabase_uid('viewer_user'), 'viewer');

select tests.authenticate_as('member_user');

insert into public.items (home_id, title, warning_amount, created_by_id)
values (
  (select home_id from test_state),
  'Laundry Detergent',
  1,
  tests.get_supabase_uid('member_user')
);

insert into public.categories (home_id, name)
values
  ((select home_id from test_state), 'Cleaning'),
  ((select home_id from test_state), 'Bulk Buy');

-- Pin the fixture ids while a member can still see them. Resolving these
-- inline later would break the outsider assertions: RLS hides the items and
-- categories rows from them, so the sub-select would yield null and the insert
-- would fail on a not-null violation instead of the policy we mean to test.
create temp table fixture_ids (label text primary key, id uuid);

grant select on fixture_ids to authenticated, anon, service_role;

insert into fixture_ids (label, id)
values
  ('item', (select id from public.items
            where home_id = (select home_id from test_state)
              and title = 'Laundry Detergent')),
  ('cat_cleaning', (select id from public.categories
            where home_id = (select home_id from test_state)
              and name = 'Cleaning')),
  ('cat_bulk', (select id from public.categories
            where home_id = (select home_id from test_state)
              and name = 'Bulk Buy'));

-- ============================================================
-- notifications — private to the recipient, and client-unwritable
-- ============================================================

-- Only the backend writes notifications, so seed them past RLS.
select tests.authenticate_as_service_role();

insert into public.notifications (user_id, home_id, message, type)
values
  (tests.get_supabase_uid('member_user'), (select home_id from test_state), 'Detergent is running low', 'low_stock'),
  (tests.get_supabase_uid('member_user'), (select home_id from test_state), 'Weekly summary is ready', 'digest'),
  (tests.get_supabase_uid('viewer_user'), (select home_id from test_state), 'Someone added you to a home', 'membership');

select tests.authenticate_as('member_user');

select is(
  (select count(*)::integer from public.notifications),
  2,
  'A user sees exactly their own notifications'
);

-- Sharing a home is not enough — notifications are addressed, not broadcast.
select is(
  (select count(*)::integer from public.notifications
   where user_id = tests.get_supabase_uid('viewer_user')),
  0,
  'A user cannot see a home-mate notification'
);

-- There is no INSERT policy on notifications at all, so even a well-formed
-- row addressed to yourself is refused.
select throws_ok(
  format(
    'insert into public.notifications (user_id, home_id, message, type) values (%L, %L, %L, %L)',
    tests.get_supabase_uid('member_user'),
    (select home_id from test_state),
    'Self-issued notification',
    'low_stock'
  ),
  '42501',
  null,
  'A user cannot insert a notification for themselves'
);

select throws_ok(
  format(
    'insert into public.notifications (user_id, home_id, message, type) values (%L, %L, %L, %L)',
    tests.get_supabase_uid('viewer_user'),
    (select home_id from test_state),
    'Forged notification',
    'low_stock'
  ),
  '42501',
  null,
  'A user cannot insert a notification for someone else'
);

select lives_ok(
  $$update public.notifications set is_read = true where message = 'Detergent is running low'$$,
  'A user can mark their own notification read'
);

select is(
  (select is_read from public.notifications where message = 'Detergent is running low'),
  true,
  'Marking a notification read persists'
);

-- The UPDATE policy's USING clause filters someone else's row away rather
-- than raising, so count the rows the statement actually touched.
create temp table foreign_notification_update as
with u as (
  update public.notifications
  set is_read = true
  where message = 'Someone added you to a home'
  returning id
)
select id from u;

grant select on foreign_notification_update to authenticated, anon, service_role;

select is(
  (select count(*)::integer from foreign_notification_update),
  0,
  'A user cannot mark another user notification read'
);

create temp table foreign_notification_delete as
with d as (
  delete from public.notifications
  where message = 'Someone added you to a home'
  returning id
)
select id from d;

grant select on foreign_notification_delete to authenticated, anon, service_role;

select is(
  (select count(*)::integer from foreign_notification_delete),
  0,
  'A user cannot delete another user notification'
);

create temp table own_notification_delete as
with d as (
  delete from public.notifications
  where message = 'Weekly summary is ready'
  returning id
)
select id from d;

grant select on own_notification_delete to authenticated, anon, service_role;

select is(
  (select count(*)::integer from own_notification_delete),
  1,
  'A user can delete their own notification'
);

select tests.clear_authentication();

select is(
  (select count(*)::integer from public.notifications),
  0,
  'An anonymous session sees no notifications'
);

-- ============================================================
-- device_tokens — private to the owning user in every direction
-- ============================================================

select tests.authenticate_as_service_role();

insert into public.device_tokens (user_id, token, platform)
values (tests.get_supabase_uid('viewer_user'), 'viewer-device-token', 'ios');

select tests.authenticate_as('member_user');

select lives_ok(
  format(
    'insert into public.device_tokens (user_id, token, platform) values (%L, %L, %L)',
    tests.get_supabase_uid('member_user'),
    'member-device-token',
    'ios'
  ),
  'A user can register their own device token'
);

select throws_ok(
  format(
    'insert into public.device_tokens (user_id, token, platform) values (%L, %L, %L)',
    tests.get_supabase_uid('viewer_user'),
    'forged-device-token',
    'android'
  ),
  '42501',
  null,
  'A user cannot register a device token for someone else'
);

select is(
  (select count(*)::integer from public.device_tokens),
  1,
  'A user sees exactly their own device tokens'
);

select is(
  (select count(*)::integer from public.device_tokens
   where user_id = tests.get_supabase_uid('viewer_user')),
  0,
  'A user cannot see another user device token'
);

select lives_ok(
  $$update public.device_tokens set platform = 'android' where token = 'member-device-token'$$,
  'A user can update their own device token'
);

select is(
  (select platform from public.device_tokens where token = 'member-device-token'),
  'android',
  'The device token update persists'
);

-- WITH CHECK is what stops a user handing their own row to someone else;
-- without it the USING clause alone would happily let the row walk away.
select throws_ok(
  format(
    $$update public.device_tokens set user_id = %L where token = 'member-device-token'$$,
    tests.get_supabase_uid('viewer_user')
  ),
  '42501',
  'new row violates row-level security policy for table "device_tokens"',
  'A user cannot reassign their device token to another user'
);

create temp table foreign_token_update as
with u as (
  update public.device_tokens
  set platform = 'web'
  where token = 'viewer-device-token'
  returning id
)
select id from u;

grant select on foreign_token_update to authenticated, anon, service_role;

select is(
  (select count(*)::integer from foreign_token_update),
  0,
  'A user cannot update another user device token'
);

create temp table foreign_token_delete as
with d as (
  delete from public.device_tokens
  where token = 'viewer-device-token'
  returning id
)
select id from d;

grant select on foreign_token_delete to authenticated, anon, service_role;

select is(
  (select count(*)::integer from foreign_token_delete),
  0,
  'A user cannot delete another user device token'
);

create temp table own_token_delete as
with d as (
  delete from public.device_tokens
  where token = 'member-device-token'
  returning id
)
select id from d;

grant select on own_token_delete to authenticated, anon, service_role;

select is(
  (select count(*)::integer from own_token_delete),
  1,
  'A user can delete their own device token'
);

select tests.clear_authentication();

select is(
  (select count(*)::integer from public.device_tokens),
  0,
  'An anonymous session sees no device tokens'
);

-- ============================================================
-- item_categories — reach is inherited from the item it points at
-- ============================================================

select tests.authenticate_as('member_user');

select lives_ok(
  format(
    'insert into public.item_categories (item_id, category_id) values (%L, %L)',
    (select id from fixture_ids where label = 'item'),
    (select id from fixture_ids where label = 'cat_cleaning')
  ),
  'A member can categorise an item'
);

-- SELECT is open to every role in the home, unlike the write policies.
select tests.authenticate_as('viewer_user');

select is(
  (select count(*)::integer from public.item_categories),
  1,
  'A viewer can read item categories'
);

select throws_ok(
  format(
    'insert into public.item_categories (item_id, category_id) values (%L, %L)',
    (select id from fixture_ids where label = 'item'),
    (select id from fixture_ids where label = 'cat_bulk')
  ),
  '42501',
  null,
  'A viewer cannot categorise an item'
);

-- Contributors can move stock counts but not reshape the taxonomy.
select tests.authenticate_as('contrib_user');

select throws_ok(
  format(
    'insert into public.item_categories (item_id, category_id) values (%L, %L)',
    (select id from fixture_ids where label = 'item'),
    (select id from fixture_ids where label = 'cat_bulk')
  ),
  '42501',
  null,
  'A contributor cannot categorise an item'
);

create temp table contrib_category_delete as
with d as (
  delete from public.item_categories
  returning item_id
)
select item_id from d;

grant select on contrib_category_delete to authenticated, anon, service_role;

select is(
  (select count(*)::integer from contrib_category_delete),
  0,
  'A contributor cannot remove an item category'
);

-- An outsider fails the join through items, so the row is neither visible
-- nor writable — the same EXISTS clause covers both directions.
select tests.authenticate_as('outsider_user');

select is(
  (select count(*)::integer from public.item_categories),
  0,
  'An outsider cannot read item categories'
);

select throws_ok(
  format(
    'insert into public.item_categories (item_id, category_id) values (%L, %L)',
    (select id from fixture_ids where label = 'item'),
    (select id from fixture_ids where label = 'cat_bulk')
  ),
  '42501',
  null,
  'An outsider cannot categorise an item in a home they do not belong to'
);

select tests.authenticate_as('member_user');

create temp table member_category_delete as
with d as (
  delete from public.item_categories
  returning item_id
)
select item_id from d;

grant select on member_category_delete to authenticated, anon, service_role;

select is(
  (select count(*)::integer from member_category_delete),
  1,
  'A member can remove an item category'
);

select * from finish();
rollback;
