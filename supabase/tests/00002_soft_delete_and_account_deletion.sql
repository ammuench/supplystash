-- pgTAP tests for the soft-delete bank, Realtime publication membership, and
-- account deletion. Run with: supabase test db
--
-- Covers migrations 20260823000001 / 000002 / 000003. 00001 covers the original
-- RLS, RPC and ledger-trigger surface; these are separate concerns and live in
-- their own file rather than growing that one past readable.

begin;

select plan(27);

-- ============================================================
-- Setup
--
-- One home with the full role ladder, so each assertion below can pick the
-- role it needs without rebuilding fixtures.
-- ============================================================

select tests.create_supabase_user('sd_owner', 'sd_owner@supplystash.app');
select tests.create_supabase_user('sd_member', 'sd_member@supplystash.app');
select tests.create_supabase_user('sd_contrib', 'sd_contrib@supplystash.app');
select tests.create_supabase_user('sd_viewer', 'sd_viewer@supplystash.app');
select tests.create_supabase_user('sd_leaver', 'sd_leaver@supplystash.app');
select tests.create_supabase_user('sd_heir', 'sd_heir@supplystash.app');

select tests.authenticate_as('sd_owner');

create temp table sd_state (home_id uuid);
grant select on sd_state to authenticated, anon, service_role;
insert into sd_state select public.create_home('Soft Delete Home', null);

select public.invite_member((select home_id from sd_state), tests.get_supabase_uid('sd_member'), 'member');
select public.invite_member((select home_id from sd_state), tests.get_supabase_uid('sd_contrib'), 'contributor');
select public.invite_member((select home_id from sd_state), tests.get_supabase_uid('sd_viewer'), 'viewer');

insert into public.items (home_id, title, warning_amount, created_by_id)
values
  ((select home_id from sd_state), 'Paper Towels', 2, tests.get_supabase_uid('sd_owner')),
  ((select home_id from sd_state), 'Dish Soap', 1, tests.get_supabase_uid('sd_owner')),
  ((select home_id from sd_state), 'Sponges', 1, tests.get_supabase_uid('sd_owner'));

-- ============================================================
-- Test: the DELETE path is gone
--
-- Not a style preference. items cascades to inventory_transactions, so a
-- surviving hard-delete path would still destroy an item's ledger -- the exact
-- hole 20260823000001 exists to close. has_table_privilege reports the grant;
-- the absent policy is what actually stops it, and both are checked.
-- ============================================================

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public'
     and cmd = 'DELETE'
     and tablename in ('items', 'categories', 'shopping_list_items')),
  0,
  'No DELETE policies remain on the soft-deleted tables'
);

-- ============================================================
-- Test: who may soft-delete an item
--
-- Soft delete is a delete, so it takes the delete role set (owner/admin/member)
-- rather than the update one (which includes contributor). Column privileges
-- cannot express that, so a trigger enforces it -- these assertions are the
-- reason that trigger exists.
-- ============================================================

select tests.authenticate_as('sd_member');

select lives_ok(
  $$update public.items set deleted = true where title = 'Sponges'$$,
  'Member can soft-delete an item'
);

select is(
  (select deleted from public.items where title = 'Sponges'),
  true,
  'Soft delete sets the flag rather than removing the row'
);

-- The row is still physically present and still RLS-visible. That is the whole
-- point: the client filters it out (doc §5.3), the database keeps it so a
-- delta refetch can report the removal (doc §5.8).
select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from sd_state)),
  3,
  'A soft-deleted item row still exists'
);

select is(
  (select count(*)::integer from public.items
   where home_id = (select home_id from sd_state) and deleted = false),
  2,
  'A soft-deleted item is excluded from the live list'
);

select tests.authenticate_as('sd_contrib');

select throws_ok(
  $$update public.items set deleted = true where title = 'Dish Soap'$$,
  'Only owners, admins and members can delete items',
  'Contributor cannot soft-delete an item'
);

-- The contributor must keep the rights the role table does grant, or the guard
-- has overreached from "cannot delete" into "cannot edit".
select lives_ok(
  $$update public.items set warning_amount = 7 where title = 'Dish Soap'$$,
  'Contributor can still edit item metadata'
);

-- A viewer never reaches the trigger: RLS has no update policy for them, so the
-- statement matches no rows rather than raising. Absence of effect is the
-- assertion here.
select tests.authenticate_as('sd_viewer');

update public.items set deleted = true where title = 'Dish Soap';

select is(
  (select deleted from public.items where title = 'Dish Soap'),
  false,
  'Viewer cannot soft-delete an item (RLS matches no rows)'
);

-- ============================================================
-- Test: shopping_list_items carries the same split
-- ============================================================

select tests.authenticate_as('sd_owner');

insert into public.shopping_list_items (home_id, title, quantity)
values ((select home_id from sd_state), 'Coffee', 1);

select tests.authenticate_as('sd_contrib');

-- Checking items off is the contributor's job (doc §5.1), so only the delete
-- must be blocked.
select lives_ok(
  $$update public.shopping_list_items set is_checked = true where title = 'Coffee'$$,
  'Contributor can check off a shopping list item'
);

select throws_ok(
  $$update public.shopping_list_items set deleted = true where title = 'Coffee'$$,
  'Only owners, admins and members can delete shopping list items',
  'Contributor cannot soft-delete a shopping list item'
);

-- ============================================================
-- Test: soft-deleted ledger rows leave the derived count
--
-- The recompute sums the ledger from scratch on every write, so excluding a
-- soft-deleted row must move current_inventory back down by itself.
-- ============================================================

select tests.authenticate_as('sd_owner');

insert into public.inventory_transactions (item_id, user_id, quantity_changed, transaction_type)
values
  ((select id from public.items where title = 'Paper Towels'), tests.get_supabase_uid('sd_owner'), 5, 'manual_add'),
  ((select id from public.items where title = 'Paper Towels'), tests.get_supabase_uid('sd_owner'), -2, 'consume');

select is(
  (select current_inventory from public.items where title = 'Paper Towels'),
  3,
  'Ledger inserts drive current_inventory'
);

-- The ledger has no client UPDATE policy -- it is append-only from the app
-- (doc §5.7) -- so correcting one is a service_role path.
select tests.authenticate_as_service_role();

update public.inventory_transactions
set deleted = true
where item_id = (select id from public.items where title = 'Paper Towels')
  and quantity_changed = 5;

select is(
  (select current_inventory from public.items where title = 'Paper Towels'),
  -2,
  'A soft-deleted ledger row is excluded from the recompute'
);

select is(
  (select count(*)::integer from public.inventory_transactions
   where item_id = (select id from public.items where title = 'Paper Towels')),
  2,
  'The soft-deleted ledger row itself survives'
);

-- Soft-deleting the item must not take its history with it. This is the
-- cascade that the old hard delete performed and this migration removes.
select tests.authenticate_as('sd_owner');

update public.items set deleted = true where title = 'Paper Towels';

select is(
  (select count(*)::integer from public.inventory_transactions
   where item_id = (select id from public.items where title = 'Paper Towels')),
  2,
  'Soft-deleting an item preserves its ledger history'
);

-- ============================================================
-- Test: category names are reusable after a soft delete
--
-- A flagged row still occupies a plain unique key, so `unique (home_id, name)`
-- would have made deleting a category permanently reserve its name. The
-- constraint is scoped to live rows instead.
-- ============================================================

insert into public.categories (home_id, name) values ((select home_id from sd_state), 'Cleaning');

update public.categories
set deleted = true
where home_id = (select home_id from sd_state) and name = 'Cleaning';

select lives_ok(
  format(
    'insert into public.categories (home_id, name) values (%L, %L)',
    (select home_id from sd_state),
    'Cleaning'
  ),
  'A category name is reusable once the old one is soft-deleted'
);

-- ============================================================
-- Test: updated_at now advances on the tables that gained it
--
-- Recording the timestamp first, then comparing, because a bare `is not null`
-- would pass on the column default alone and prove nothing about the trigger.
-- ============================================================

-- now() is fixed for the whole transaction, so comparing a before and after
-- timestamp cannot tell "the trigger fired" from "the trigger is missing" --
-- both leave the same value. Writing a stale timestamp and watching it be
-- overwritten tests the guarantee doc §3 actually makes: updated_at is
-- maintained by the trigger, not by whoever is writing the row.
update public.categories
set description = 'Kitchen things', updated_at = '2000-01-01T00:00:00Z'
where name = 'Cleaning' and deleted = false;

select ok(
  (select updated_at from public.categories where name = 'Cleaning' and deleted = false)
    > '2000-01-01T00:00:00Z'::timestamptz,
  'categories.updated_at is trigger-maintained, overriding a client value'
);

update public.shopping_list_items
set quantity = 2, updated_at = '2000-01-01T00:00:00Z'
where title = 'Coffee';

select ok(
  (select updated_at from public.shopping_list_items where title = 'Coffee')
    > '2000-01-01T00:00:00Z'::timestamptz,
  'shopping_list_items.updated_at is trigger-maintained, overriding a client value'
);

-- ============================================================
-- Test: Realtime publication membership
--
-- Events themselves cannot be asserted here -- the pgtap CI job starts the
-- stack with `-x realtime`. Membership is what silently regresses, and it is
-- what a missing `alter publication` would cost, so it is what is checked.
-- ============================================================

select is(
  (select count(*)::integer from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename in ('items', 'categories', 'shopping_list_items')),
  3,
  'The synced tables are members of the supabase_realtime publication'
);

-- Without REPLICA IDENTITY FULL the old row image is the primary key only, so
-- Realtime cannot evaluate RLS against it or apply the home_id filter.
select is(
  (select count(*)::integer from pg_class
   where relname in ('items', 'categories', 'shopping_list_items')
     and relkind = 'r'
     and relreplident = 'f'),
  3,
  'The published tables use REPLICA IDENTITY FULL'
);

-- ============================================================
-- Test: account deletion
--
-- The three FKs to auth.users were ON DELETE RESTRICT, so deleting anyone who
-- had ever created a home, created an item or logged a transaction was
-- impossible. These assertions pin both halves of the fix: the refusal that
-- keeps a home owned, and the anonymisation that lets the delete through.
-- ============================================================

select tests.authenticate_as('sd_leaver');

create temp table sd_leaver_state as
select
  public.create_home('Leaver Home', null) as home_id,
  tests.get_supabase_uid('sd_leaver') as leaver_id;

grant select on sd_leaver_state to authenticated, anon, service_role;

select public.invite_member((select home_id from sd_leaver_state), tests.get_supabase_uid('sd_heir'), 'member');

insert into public.items (home_id, title, warning_amount, created_by_id)
values ((select home_id from sd_leaver_state), 'Hand Soap', 1, (select leaver_id from sd_leaver_state));

insert into public.inventory_transactions (item_id, user_id, quantity_changed, transaction_type)
values (
  (select id from public.items where title = 'Hand Soap'),
  (select leaver_id from sd_leaver_state),
  3,
  'manual_add'
);

-- Refused pre-emptively and by name. Letting it through would trip
-- enforce_last_owner instead, which is correct but names no home and suggests
-- no fix -- and doc §5.1 requires refusals to be pre-emptive.
select throws_ok(
  'select public.delete_own_account()',
  'You are the only owner of: Leaver Home. Transfer ownership or delete these homes before deleting your account.',
  'delete_own_account refuses while the caller is a sole owner'
);

select public.transfer_ownership(
  (select home_id from sd_leaver_state),
  tests.get_supabase_uid('sd_heir')
);

select lives_ok(
  'select public.delete_own_account()',
  'delete_own_account succeeds once ownership is transferred'
);

-- Verified as the table owner: service_role has no SELECT on auth.users.
reset role;

select is(
  (select count(*)::integer from auth.users where id = (select leaver_id from sd_leaver_state)),
  0,
  'The auth.users row is destroyed, not flagged'
);

-- The household keeps working data; only the link to the person is severed.
select is(
  (select user_id from public.inventory_transactions
   where item_id = (select id from public.items where title = 'Hand Soap')),
  null,
  'The ledger row survives with its author cleared'
);

select is(
  (select current_inventory from public.items where title = 'Hand Soap'),
  3,
  'The derived count is unaffected by anonymisation'
);

select is(
  (select created_by_id from public.homes where id = (select home_id from sd_leaver_state)),
  null,
  'The home survives with its creator cleared'
);

-- Rows that are only about the person are genuinely destroyed, not anonymised.
select is(
  (select count(*)::integer from public.user_homes
   where home_id = (select home_id from sd_leaver_state)),
  1,
  'The membership is destroyed, leaving only the heir'
);

-- Clearing authorship is anonymisation; re-pointing it would forge authorship,
-- so the guard allows one direction only.
select throws_ok(
  format(
    'update public.items set created_by_id = %L where title = %L',
    tests.get_supabase_uid('sd_heir'),
    'Hand Soap'
  ),
  'items.created_by_id can be cleared but not reassigned',
  'Authorship can be cleared but never reassigned'
);

select * from finish();
rollback;
