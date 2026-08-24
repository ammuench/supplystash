-- Explicit table grants
--
-- Until now every table privilege for anon/authenticated/service_role came
-- from Supabase's ALTER DEFAULT PRIVILEGES, applied implicitly when a table
-- was created. Newer Supabase images no longer ship those defaults, so a
-- fresh stack (like CI's `supabase start` on the latest CLI) raises
-- "permission denied for table ..." before RLS is even consulted. Grant
-- everything explicitly so the schema carries its own privileges.
--
-- RLS remains the actual access control on every table; these grants only
-- restore the baseline that RLS policies filter.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- The blanket grant above just re-opened items INSERT/UPDATE, undoing the
-- column locks from 20260415000005 §3 (derived-column protection) and
-- 20260823000001 §4 (soft-delete column). Re-apply them verbatim.
revoke insert, update on public.items from authenticated;

grant insert (
  id,
  home_id,
  title,
  description,
  photo_url,
  barcode,
  purchase_link,
  warning_amount,
  is_archived,
  created_by_id
) on public.items to authenticated;

grant update (
  title,
  description,
  photo_url,
  barcode,
  purchase_link,
  warning_amount,
  is_archived,
  updated_at,
  deleted
) on public.items to authenticated;
