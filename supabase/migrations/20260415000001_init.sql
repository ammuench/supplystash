-- Supply Stash — ledger-first schema
-- Source of truth: supply-stash-architecture.md §3

set lock_timeout = '4s';
set statement_timeout = '10s';

create extension if not exists "pgcrypto";

-- homes
create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id uuid not null references auth.users (id) on delete restrict
);

-- user_homes junction
create table if not exists public.user_homes (
  user_id uuid not null references auth.users (id) on delete cascade,
  home_id uuid not null references public.homes (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'contributor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (user_id, home_id)
);

create index if not exists user_homes_home_id_idx on public.user_homes (home_id);

-- categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (home_id, name)
);

-- items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  title text not null,
  description text,
  photo_url text,
  barcode text,
  purchase_link text,
  current_inventory integer not null default 0,
  warning_amount integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id uuid not null references auth.users (id) on delete restrict
);

create index if not exists items_home_id_idx on public.items (home_id);
create index if not exists items_barcode_idx on public.items (barcode) where barcode is not null;

-- item_categories junction
create table if not exists public.item_categories (
  item_id uuid not null references public.items (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (item_id, category_id)
);

-- inventory_transactions (ledger — source of truth)
do $$ begin
  create type public.inventory_transaction_type as enum (
    'manual_add',
    'manual_remove',
    'purchase',
    'consume',
    'correction',
    'bulk_import'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  quantity_changed integer not null,
  transaction_type public.inventory_transaction_type not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_transactions_item_id_idx on public.inventory_transactions (item_id);

-- shopping_list_items
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  title text not null,
  quantity integer not null default 1,
  is_checked boolean not null default false,
  checked_by_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

create index if not exists shopping_list_items_home_id_idx on public.shopping_list_items (home_id);

-- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  home_id uuid references public.homes (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

-- device_tokens (FCM)
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

-- Ledger → cached count trigger
create or replace function public.update_item_inventory()
returns trigger
language plpgsql
as $$
begin
  update public.items
  set
    current_inventory = (
      select coalesce(sum(quantity_changed), 0)
      from public.inventory_transactions
      where item_id = new.item_id
    ),
    updated_at = now()
  where id = new.item_id;
  return new;
end;
$$;

create trigger on_inventory_transaction
after insert on public.inventory_transactions
for each row
execute function public.update_item_inventory();
