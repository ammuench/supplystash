-- Supply Stash — limit the length of a home's name
--
-- homes.name was `text not null` with no length check. The create home form
-- limits a name to 50 characters (HOME_NAME_MAX_LENGTH in
-- apps/supplystash/lib/schemas/home.ts). Without the same rule here, any other
-- caller of create_home or update_home could store a name the app would reject.
-- Change the two limits together.
--
-- A table constraint rather than a check inside create_home: it covers
-- update_home and any future write with one rule.
--
-- The lower bound closes a gap in update_home (…0003). It sets
-- `name = coalesce(trim(p_name), name)`, and trim('   ') is an empty string,
-- not null, so a blank rename was stored as an empty name. create_home already
-- refuses a blank name with its own message; that check stays.
--
-- btrim() so the rule matches what the RPCs store: both trim the name first.
-- char_length() counts characters, not bytes, so an accented letter or an emoji
-- counts as one.
--
-- A violation raises SQLSTATE 23514 (check_violation).
--
-- Two steps, in two transactions. `not valid` adds the rule for new writes
-- without scanning the table, so the lock that blocks writes is brief. `validate`
-- then checks the existing rows under a lock that still lets other sessions read
-- and write. It fails if a stored name breaks the rule. Find those first with:
--
--   select id, name from public.homes
--   where char_length(btrim(name)) not between 1 and 50;

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

alter table public.homes
  add constraint homes_name_length
  check (char_length(btrim(name)) between 1 and 50) not valid;

commit;

begin;

alter table public.homes validate constraint homes_name_length;

commit;
