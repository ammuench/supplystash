-- Supply Stash — share-link invites (STASH-54)
--
-- invite_member (…0003) needs the invitee's user ID, which a client cannot
-- look up, and it adds that person without asking them. A share link fixes
-- both: an owner or admin creates an invite, sends its token through the OS
-- share sheet, and the recipient accepts it while signed in.
--
-- Rules settled in STASH-54:
--   * Single-use. Accepting marks the invite used.
--   * Lives 7 days (the expires_at default).
--   * Grants member or viewer only. Promotion goes through update_member_role,
--     so a leaked link can never hand out admin or owner.
--
-- The token is the secret. Only owners and admins of the home can read the
-- table, so a plain member cannot copy a link they were not given.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

create table if not exists public.home_invites (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  -- 128 random bits: not guessable, and hex is safe in a URL without escaping.
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  role text not null default 'member' check (role in ('member', 'viewer')),
  -- Cascade: an invite from a deleted account should stop working.
  created_by_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  -- Set null, not cascade: the used invite is history even if the joiner
  -- later deletes their account.
  used_by_id uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

create index if not exists home_invites_home_id_idx on public.home_invites (home_id);

-- ============================================================
-- RLS — owners and admins read, all writes via RPCs
-- ============================================================

alter table public.home_invites enable row level security;

create policy "admins can view invites for their homes"
  on public.home_invites for select
  using (public.is_home_admin_or_above(home_id));

create policy "no direct inserts"
  on public.home_invites for insert
  with check (false);

create policy "no direct updates"
  on public.home_invites for update
  using (false);

create policy "no direct deletes"
  on public.home_invites for delete
  using (false);

-- New tables get no default privileges on current Supabase images
-- (see 20260823000004). RLS above is the real access control.
grant all on public.home_invites to anon, authenticated, service_role;

commit;
