-- Supply Stash — Row Level Security
-- Source of truth: supply-stash-architecture.md §4
-- Design: homes/user_homes writes are RPC-only (online-only ops).
-- Item-scoped tables use per-role policies for offline-capable CRUD.

set lock_timeout = '4s';
set statement_timeout = '10s';

begin;

-- ============================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================

create or replace function public.is_home_member(home_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_homes
    where user_id = auth.uid()
      and home_id = home_uuid
  );
$$;

create or replace function public.is_home_owner(home_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_homes
    where user_id = auth.uid()
      and home_id = home_uuid
      and role = 'owner'
  );
$$;

create or replace function public.is_home_admin_or_above(home_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_homes
    where user_id = auth.uid()
      and home_id = home_uuid
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.get_home_role(home_uuid uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.user_homes
  where user_id = auth.uid()
    and home_id = home_uuid;
$$;

-- ============================================================
-- homes — read-only via RLS, all writes via RPCs
-- ============================================================

alter table public.homes enable row level security;

create policy "members can view their homes"
  on public.homes for select
  using (public.is_home_member(id));

create policy "no direct inserts"
  on public.homes for insert
  with check (false);

create policy "no direct updates"
  on public.homes for update
  using (false);

create policy "no direct deletes"
  on public.homes for delete
  using (false);

-- ============================================================
-- user_homes — read-only via RLS, all writes via RPCs
-- ============================================================

alter table public.user_homes enable row level security;

create policy "members can view memberships for their homes"
  on public.user_homes for select
  using (public.is_home_member(home_id));

create policy "no direct inserts"
  on public.user_homes for insert
  with check (false);

create policy "no direct updates"
  on public.user_homes for update
  using (false);

create policy "no direct deletes"
  on public.user_homes for delete
  using (false);

-- ============================================================
-- categories — member+ can read, member+ can write
-- ============================================================

alter table public.categories enable row level security;

create policy "members can view categories"
  on public.categories for select
  using (public.is_home_member(home_id));

create policy "members can insert categories"
  on public.categories for insert
  with check (
    public.get_home_role(home_id) in ('owner', 'admin', 'member')
  );

create policy "members can update categories"
  on public.categories for update
  using (
    public.get_home_role(home_id) in ('owner', 'admin', 'member')
  );

create policy "members can delete categories"
  on public.categories for delete
  using (
    public.get_home_role(home_id) in ('owner', 'admin', 'member')
  );

-- ============================================================
-- items — viewer=read, contributor=read+update, member+=full CRUD
-- ============================================================

alter table public.items enable row level security;

create policy "all home members can view items"
  on public.items for select
  using (public.is_home_member(home_id));

create policy "members can insert items"
  on public.items for insert
  with check (
    public.get_home_role(home_id) in ('owner', 'admin', 'member')
    and auth.uid() = created_by_id
  );

create policy "contributors can update items"
  on public.items for update
  using (
    public.get_home_role(home_id) in ('owner', 'admin', 'member', 'contributor')
  );

create policy "members can delete items"
  on public.items for delete
  using (
    public.get_home_role(home_id) in ('owner', 'admin', 'member')
  );

-- ============================================================
-- item_categories — follows items: member+ for writes
-- ============================================================

alter table public.item_categories enable row level security;

create policy "members can view item_categories"
  on public.item_categories for select
  using (
    exists (
      select 1 from public.items
      where items.id = item_categories.item_id
        and public.is_home_member(items.home_id)
    )
  );

create policy "members can insert item_categories"
  on public.item_categories for insert
  with check (
    exists (
      select 1 from public.items
      where items.id = item_categories.item_id
        and public.get_home_role(items.home_id) in ('owner', 'admin', 'member')
    )
  );

create policy "members can delete item_categories"
  on public.item_categories for delete
  using (
    exists (
      select 1 from public.items
      where items.id = item_categories.item_id
        and public.get_home_role(items.home_id) in ('owner', 'admin', 'member')
    )
  );

-- ============================================================
-- inventory_transactions — append-only ledger
-- viewer=read, contributor+=insert, no update/delete
-- ============================================================

alter table public.inventory_transactions enable row level security;

create policy "members can view transactions"
  on public.inventory_transactions for select
  using (
    exists (
      select 1 from public.items
      where items.id = inventory_transactions.item_id
        and public.is_home_member(items.home_id)
    )
  );

create policy "contributors can insert transactions"
  on public.inventory_transactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.items
      where items.id = inventory_transactions.item_id
        and public.get_home_role(items.home_id) in ('owner', 'admin', 'member', 'contributor')
    )
  );

-- No update/delete — append-only by design.

-- ============================================================
-- shopping_list_items — contributor+ can write
-- ============================================================

alter table public.shopping_list_items enable row level security;

create policy "members can view shopping list"
  on public.shopping_list_items for select
  using (public.is_home_member(home_id));

create policy "contributors can insert shopping list items"
  on public.shopping_list_items for insert
  with check (
    public.get_home_role(home_id) in ('owner', 'admin', 'member', 'contributor')
  );

create policy "contributors can update shopping list items"
  on public.shopping_list_items for update
  using (
    public.get_home_role(home_id) in ('owner', 'admin', 'member', 'contributor')
  );

create policy "members can delete shopping list items"
  on public.shopping_list_items for delete
  using (
    public.get_home_role(home_id) in ('owner', 'admin', 'member')
  );

-- ============================================================
-- notifications — user's own only
-- ============================================================

alter table public.notifications enable row level security;

create policy "users can view their notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "users can update their notifications"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "users can delete their notifications"
  on public.notifications for delete
  using (user_id = auth.uid());

-- ============================================================
-- device_tokens — user's own only
-- ============================================================

alter table public.device_tokens enable row level security;

create policy "users can view their device tokens"
  on public.device_tokens for select
  using (user_id = auth.uid());

create policy "users can insert their device tokens"
  on public.device_tokens for insert
  with check (user_id = auth.uid());

create policy "users can update their device tokens"
  on public.device_tokens for update
  using (user_id = auth.uid());

create policy "users can delete their device tokens"
  on public.device_tokens for delete
  using (user_id = auth.uid());

commit;
