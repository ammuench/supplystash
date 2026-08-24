-- Test helpers for pgTAP — based on basejump-supabase_test_helpers
-- Creates the tests schema and helper functions used by all test files.
-- This file must sort before all other test files (hence 00000_ prefix).

create schema if not exists tests;

-- Enable pgTAP
create extension if not exists pgtap with schema extensions;

-- ============================================================
-- tests.create_supabase_user(identifier, email)
-- Creates a fake user in auth.users for testing.
-- ============================================================

create or replace function tests.create_supabase_user(
  p_identifier text,
  p_email text default null
)
returns uuid
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    coalesce(p_email, p_identifier || '@test.local'),
    crypt('password123', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('test_identifier', p_identifier),
    now(),
    now(),
    '',
    ''
  );

  -- Store the mapping so we can look it up later
  insert into tests._test_users (identifier, user_id)
  values (p_identifier, v_user_id);

  return v_user_id;
end;
$$;

-- ============================================================
-- Lookup table for test user identifiers → UUIDs
-- ============================================================

create table if not exists tests._test_users (
  identifier text primary key,
  user_id uuid not null
);

-- ============================================================
-- tests.get_supabase_uid(identifier)
-- Returns the UUID for a test user by identifier.
-- ============================================================

create or replace function tests.get_supabase_uid(p_identifier text)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select user_id from tests._test_users where identifier = p_identifier;
$$;

-- ============================================================
-- tests.authenticate_as(identifier)
-- Sets the current session to act as the given test user.
-- This makes auth.uid() return their UUID and RLS policies apply.
-- ============================================================

create or replace function tests.authenticate_as(p_identifier text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := tests.get_supabase_uid(p_identifier);

  if v_user_id is null then
    raise exception 'Test user "%" not found', p_identifier;
  end if;

  -- Set the role to authenticated (what real logged-in users use)
  perform set_config('role', 'authenticated', true);
  -- Set the JWT sub claim so auth.uid() returns this user's ID
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
end;
$$;

-- ============================================================
-- tests.authenticate_as_service_role()
-- Elevates to service_role — bypasses RLS entirely.
-- Used to test triggers and invariants directly.
-- ============================================================

create or replace function tests.authenticate_as_service_role()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- ============================================================
-- tests.clear_authentication()
-- Resets to anon role with no JWT claims.
-- ============================================================

create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- ============================================================
-- Grants
-- tests.authenticate_as() switches the session role to `authenticated`,
-- so every later tests.* call runs as that role. Without USAGE on the
-- schema and EXECUTE on the helpers, the first post-authentication call
-- fails with "permission denied for schema tests".
-- ============================================================

grant usage on schema tests to authenticated, anon, service_role;
grant execute on all functions in schema tests to authenticated, anon, service_role;
grant select on tests._test_users to authenticated, anon, service_role;

-- This file defines helpers rather than asserting behavior, but pg_prove
-- needs a plan in every file it globs. Assert the helpers actually loaded.
select plan(1);

select has_function('tests', 'authenticate_as', 'Test helpers are installed');

select * from finish();
