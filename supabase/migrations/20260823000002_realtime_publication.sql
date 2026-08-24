-- Supply Stash — Realtime publication membership
-- Source of truth: supply-stash-architecture.md §5.3, §5.4
--
-- Realtime's postgres_changes does not watch tables directly. It decodes the
-- WAL through a publication named `supabase_realtime`, and a table emits events
-- only if it is a member. That publication ships empty.
--
-- Left empty, the §5.3 bridge subscribes, receives SUBSCRIBED, throws no error
-- and never fires -- degrading silently to refetch-on-mount/focus, which is
-- exactly what §5.3 names as the bridge's own fallback, so it looks like it is
-- working. That silent-success shape is the one §5.1 forbids, and it would be
-- found by a household member's change failing to appear on another phone
-- rather than by anything in CI.
--
-- Membership matches the §5.4 persistence allowlist -- items, categories,
-- shopping_list_items -- minus homes, which changes rarely and is refetched on
-- mount. The ledger is deliberately absent: §5.2 keeps it off the client
-- entirely, and item counts reach the client as items.current_inventory.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- Supabase provisions this publication, but a bare `supabase db reset` against
-- a stack started without Realtime will not. Create it empty if missing so the
-- migration chain applies in both cases -- notably the pgtap CI job, which runs
-- `supabase start -x realtime`.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['items', 'categories', 'shopping_list_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

-- Postgres logs only the primary key in the old-row image by default. Realtime
-- needs the whole old row to evaluate RLS against it and to apply the
-- `home_id=eq.…` filter the §5.3 bridge subscribes with -- without this, an
-- update to a row the subscriber is not entitled to see, or one belonging to a
-- different home, cannot be filtered correctly.
--
-- This also covers deletions: …0001 of this batch turned them into updates, so
-- every removal now arrives on the UPDATE path.
alter table public.items replica identity full;
alter table public.categories replica identity full;
alter table public.shopping_list_items replica identity full;

commit;
