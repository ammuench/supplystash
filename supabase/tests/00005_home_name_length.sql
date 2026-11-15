-- pgTAP tests for the homes_name_length constraint (…20261111000001).
--
-- A home's name is 1 to 50 characters after trimming. The constraint sits on
-- the table, so these tests drive it through both RPCs that write a name:
-- create_home and update_home.
--
-- throws_ok's second argument here is a SQLSTATE, not a message: 23514 is
-- check_violation, the code the app branches on.
--
-- Run with: supabase test db

begin;

select plan(7);

-- ============================================================
-- Setup
-- ============================================================

select tests.create_supabase_user('name_owner', 'name-owner@supplystash.app');
select tests.authenticate_as('name_owner');

create temp table home_under_test (home_id uuid);

-- Temp tables belong to the session user, but the reads below happen as the
-- authenticated role. Without this grant they fail with "permission denied".
grant select on home_under_test to authenticated, anon, service_role;

insert into home_under_test (home_id)
values (public.create_home('Name Length Home', null));

-- ============================================================
-- create_home
-- ============================================================

select lives_ok(
  format('select public.create_home(%L)', repeat('a', 50)),
  'create_home accepts a 50-character name'
);

select throws_ok(
  format('select public.create_home(%L)', repeat('a', 51)),
  '23514',
  null,
  'create_home rejects a 51-character name'
);

-- The RPC trims before it stores, so surrounding spaces do not count.
select lives_ok(
  format('select public.create_home(%L)', '  ' || repeat('a', 50) || '  '),
  'create_home accepts 50 characters with spaces around them'
);

-- One emoji is one character here, though it is two UTF-16 units in the app.
select lives_ok(
  format('select public.create_home(%L)', repeat('🏠', 50)),
  'create_home counts characters, not bytes'
);

-- ============================================================
-- update_home
-- ============================================================

select lives_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from home_under_test),
    repeat('b', 50)
  ),
  'update_home accepts a 50-character name'
);

select throws_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from home_under_test),
    repeat('b', 51)
  ),
  '23514',
  null,
  'update_home rejects a 51-character name'
);

-- update_home has no blank-name check of its own: trim('   ') is an empty
-- string, not null, so coalesce() keeps it. The constraint is what stops it.
select throws_ok(
  format(
    'select public.update_home(%L, %L)',
    (select home_id from home_under_test),
    '   '
  ),
  '23514',
  null,
  'update_home rejects a blank name'
);

select * from finish();
rollback;
