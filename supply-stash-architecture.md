# Supply Stash — Architecture & Planning Document

_Originally drafted April 2026. Rewritten August 2026 following the move from Nuxt/Capacitor to Expo/React Native._

---

## 1. Product Overview

**Supply Stash** is a home inventory management app that helps households track what they have, what they're running low on, and what they need to buy. The origin story: buying soap at Costco without knowing if you already have some at home.

### Core Value Proposition

- Track household supply inventory with simple +/- interactions
- Share inventory state across household members in real-time
- Generate shopping lists from low/out-of-stock items
- Works offline (Costco has bad signal)

### Target Users

- Couples sharing a household (primary)
- Families (3-5 people)
- Roommate situations (larger groups, less trust)

### Guiding Constraint

**Lightweight, fast to build, $0 infrastructure beyond Supabase.** Every architectural choice below is filtered through this. Pre-revenue, a recurring bill for infrastructure is a worse outcome than a slightly less capable sync layer.

---

## 2. Tech Stack

### Frontend (single codebase, three targets)

- **Expo / React Native** — leaning fully into the Expo ecosystem for velocity
- **Expo Router** — file-based routing, shared across native and web
- **React Native Reusables (RNR)** — shadcn-style component primitives for RN; Radix-backed on web, RN primitives on native
- **Uniwind** — Tailwind v4 for React Native; the same class strings compile on native and web. (Replaced NativeWind — see Decisions Log.)
- **TypeScript** throughout
- **EAS Build / EAS Update** — dev builds, OTA updates, store submission

> **On RNR vs Tamagui:** RNR is not as polished as Tamagui, but it is simpler, closer to plain RN, and fast to move in. For an app of this scope that trade is correct.

### Local State & Sync

- **TanStack Query v5** (`@tanstack/react-query`) as the read cache, mutation queue, and retry engine
- **`supabase-js`** called directly — no sync plugin, no generated data layer
- **`expo-sqlite/kv-store`** as the persistence backend on native (**not** MMKV, **not** AsyncStorage); **no persistence on web**
- **A hand-written Realtime→`invalidateQueries` bridge**, ~15 lines per table, keyed on `homeId` and the auth session
- **No sync engine and no sync service.** There is nothing additional to host, meter, or pay for.

> **There is no sync engine in this app, deliberately.** The offline surface is a cached read
> model plus a single queued boolean (§5). A sync engine would be solving a problem we removed.

### Backend (BaaS)

- **Supabase** — all-in, no custom server
  - Postgres database
  - Auth (email/password, OAuth)
  - Row Level Security (RLS) for authorization — the **sole** access-control layer
  - Edge Functions (Deno/TypeScript) for server-side business logic
  - Realtime for live updates across household members
  - Storage for user-uploaded item photos

### Push Notifications

- **Expo Push (EAS)** — one API, fronts both APNs and FCM
- **No Firebase project at all.** The Firebase/FCM dependency from the previous draft is removed entirely.

### Architecture Diagram

```
┌───────────────────────────────────────────────────────┐
│         Expo App (iOS / Android / Web)                │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  RNR + Uniwind   │  │  state/ hooks  (the only  │  │
│  │  (Expo Router)   │  │  data-access surface)     │  │
│  └──────────────────┘  └─────────────┬─────────────┘  │
│                                      │                │
│         ┌────────────────────────────▼─────────────┐  │
│         │       TanStack Query v5 QueryClient      │  │
│         │  queries keyed ['table', homeId]         │  │
│         │  + paused-mutation queue                 │  │
│         └───┬──────────────────────────────────┬───┘  │
│             │ per-query persister              │      │
│  ┌──────────▼───────────┐        ┌─────────────▼───┐  │
│  │ expo-sqlite/kv-store │        │ persistQueryClient│ │
│  │ one entry per query  │        │ mutations only    │ │
│  │ (all homes, forever) │        │ (one small blob)  │ │
│  └──────────────────────┘        └─────────────────┘  │
│                     (native only — web is memory-only)│
└──────────────────────────────────────┼────────────────┘
                                       │ supabase-js
                                       │ (reads, writes, Realtime)
                     ┌─────────────────▼──────────────────┐
                     │        Supabase (Postgres)         │
                     │  ┌──────┐ ┌─────┐ ┌────┐ ┌──────┐  │
                     │  │ Auth │ │ RLS │ │Edge│ │Store │  │
                     │  │      │ │     │ │Func│ │      │  │
                     │  └──────┘ └─────┘ └────┘ └──────┘  │
                     └─────────────────┬──────────────────┘
                                       │ Edge Function call
                     ┌─────────────────▼──────────────────┐
                     │      Expo Push (EAS)               │
                     │   → APNs (iOS) + FCM (Android)     │
                     └────────────────────────────────────┘
```

**Data flow:**

1. UI reads through `state/` hooks, which read the TanStack Query cache — instant, in-memory, rehydrated from disk at boot
2. Every query is stale immediately (`staleTime: 0`), so a cached render is followed by a background refetch — stale-while-revalidate is the default, not an exception
3. Writes go straight to Postgres via `supabase-js`. Offline, the **only** queued write is the shopping-list check-off, held as a paused mutation and persisted to disk (native only)
4. Supabase Realtime does not carry data into the cache — it fires `invalidateQueries` for the affected key and TanStack refetches. **Invalidate, never patch.**
5. RLS enforces authorization at the database level on every read and write
6. Edge Functions handle server-side logic (barcode lookups, push notification fan-out)

---

## 3. Data Model (Ledger-First)

### Key Architectural Decision: Ledger-Based Inventory

Instead of directly mutating a `current_inventory` count, all inventory changes are recorded as **append-only transactions**. The current count is a **derived value** computed from the ledger.

**Why this matters (and why it matters more now):**

- Append-only writes never conflict — two household members can independently log changes offline
- Each transaction is an independent fact ("I used 1 paper towel") that doesn't overwrite anything
- The current count is eventually consistent once all transactions sync
- Full audit trail of who changed what and when

This decision is now **load-bearing for the sync layer**. See §5 — it is the reason last-write-wins is sufficient for this app, and therefore the reason no sync engine is needed at all.

### Tables

#### `homes`

```
id            UUID (PK, default random)
name          VARCHAR(255) NOT NULL
description   TEXT
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
deleted       BOOLEAN NOT NULL DEFAULT false
created_by_id UUID NOT NULL → auth.users
```

#### `user_homes` (junction)

```
user_id       UUID NOT NULL → auth.users
home_id       UUID NOT NULL → homes
role          TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner','admin','member','contributor','viewer'))
joined_at     TIMESTAMPTZ NOT NULL DEFAULT now()
PK(user_id, home_id)
```

**Five roles, two used at launch.** The ladder is in the schema and enforced by
RLS from day one, because widening a role CHECK against a populated
`user_homes` is a migration with a backfill and a re-audit of every policy.
The v1 UI may expose only Owner and Member; the rest are already correct
underneath when a screen needs them.

| Role            | Items                | Ledger (+/- counts) | Shopping list | Members                                                       |
| --------------- | -------------------- | ------------------- | ------------- | ------------------------------------------------------------- |
| **owner**       | full CRUD            | yes                 | full          | invite, remove, set any role, transfer ownership, delete home |
| **admin**       | full CRUD            | yes                 | full          | invite, remove, set roles below admin                         |
| **member**      | full CRUD            | yes                 | full          | view only                                                     |
| **contributor** | read + edit metadata | yes                 | full          | view only                                                     |
| **viewer**      | read                 | **no**              | read          | view only                                                     |

The load-bearing split is **contributor vs member**: a contributor can log
consumption and edit an item's details but cannot create or delete items. That
is the "houseguest / kid / cleaner" shape — trusted with the counts, not with
the catalog. **viewer** is strictly read-only and is the only role that cannot
append to the ledger.

A home must always have at least one owner; a DB trigger
(`enforce_last_owner`) rejects deleting or demoting the last one, so the
invariant holds even if an RPC is bypassed.

#### `categories`

```
id            UUID (PK, default random)
home_id       UUID NOT NULL → homes  -- categories are per-home
name          VARCHAR(255) NOT NULL
description   TEXT
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
deleted       BOOLEAN NOT NULL DEFAULT false
UNIQUE(home_id, name)
```

#### `items`

```
id              UUID (PK, default random)
home_id         UUID NOT NULL → homes
title           VARCHAR(255) NOT NULL
description     TEXT
photo_url       TEXT              -- from Open Food Facts or Supabase Storage
barcode         VARCHAR(100)      -- EAN/UPC if scanned
purchase_link   TEXT
current_inventory INTEGER NOT NULL DEFAULT 0  -- DERIVED: computed from ledger
warning_amount  INTEGER NOT NULL DEFAULT 0
is_archived     BOOLEAN NOT NULL DEFAULT false
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
deleted         BOOLEAN NOT NULL DEFAULT false
created_by_id   UUID NOT NULL → auth.users
```

> **Note:** `current_inventory` is a cached/derived value maintained by a Postgres trigger. **Clients never write it.** They read it for display; the ledger is the source of truth. Because no client writes it, no client can disagree about it.

#### `item_categories` (junction)

```
item_id       UUID NOT NULL → items
category_id   UUID NOT NULL → categories
PK(item_id, category_id)
```

#### `inventory_transactions` (the ledger — source of truth)

```
id                UUID (PK, client-generated)
item_id           UUID NOT NULL → items
user_id           UUID NOT NULL → auth.users
quantity_changed  INTEGER NOT NULL       -- positive = add, negative = consume
transaction_type  ENUM('manual_add', 'manual_remove', 'purchase', 'consume', 'correction', 'bulk_import')
notes             TEXT
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
deleted           BOOLEAN NOT NULL DEFAULT false
```

> **IDs are generated client-side** (UUID v4) so that offline inserts are idempotent on replay. Re-sending a queued transaction after a flaky connection cannot create a duplicate row.

#### `shopping_list_items`

```
id            UUID (PK, client-generated)
home_id       UUID NOT NULL → homes
item_id       UUID → items               -- NULL if manually added (not from inventory)
title         VARCHAR(255) NOT NULL      -- denormalized for manual entries
quantity      INTEGER NOT NULL DEFAULT 1
is_checked    BOOLEAN NOT NULL DEFAULT false
checked_by_id UUID → auth.users
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
deleted       BOOLEAN NOT NULL DEFAULT false
checked_at    TIMESTAMPTZ
```

#### `notifications`

```
id            UUID (PK, default random)
user_id       UUID NOT NULL → auth.users
home_id       UUID → homes
item_id       UUID → items
message       TEXT NOT NULL
type          VARCHAR(100) NOT NULL
is_read       BOOLEAN NOT NULL DEFAULT false
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `device_tokens` (for Expo Push)

```
id            UUID (PK, default random)
user_id       UUID NOT NULL → auth.users
token         TEXT NOT NULL              -- Expo push token (ExponentPushToken[...])
platform      VARCHAR(20) NOT NULL       -- 'ios' | 'android'
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(user_id, token)
```

### Sync-Required Columns (banked, not currently consumed)

Every synced table carries:

- **`updated_at TIMESTAMPTZ`** — maintained by trigger
- **`deleted BOOLEAN`** — soft delete rather than hard delete

**Nothing in the v1 client reads these for sync purposes.** The client refetches whole
lists rather than deltas, so it learns about deletions by their absence. They stay because
they cost nothing, they are the substrate any future delta-sync or sync engine would need
(§5, _Escape ladder_), and adding them later to a live table is a migration with a backfill.
This is a deliberate bank, not dead weight — and it is why the sync decision is reversible
without a backend change.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to every synced table:
CREATE TRIGGER set_updated_at_items
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

> Hard deletes are avoided on synced tables. A client that was offline during a hard delete would never learn the row is gone.

### Postgres Trigger: Ledger → Cached Count

```sql
CREATE OR REPLACE FUNCTION update_item_inventory()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE items
  SET current_inventory = (
    SELECT COALESCE(SUM(quantity_changed), 0)
    FROM inventory_transactions
    WHERE item_id = NEW.item_id AND deleted = false
  ),
  updated_at = now()
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_inventory_transaction
AFTER INSERT ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_item_inventory();
```

---

## 4. RLS Policies

All data access is scoped through home membership. A user can only see/modify data for homes they belong to. **With no sync service in the stack, RLS is the only access-control layer** — there is no second set of sync rules to keep in step.

### Core pattern: "user is a member of this item's home"

```sql
-- Helper: check if current user belongs to a home
CREATE OR REPLACE FUNCTION is_home_member(home_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_homes
    WHERE user_id = auth.uid() AND home_id = home_uuid
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Items: only visible/editable by home members
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items in their homes"
  ON items FOR SELECT
  USING (is_home_member(home_id));

CREATE POLICY "Users can insert items in their homes"
  ON items FOR INSERT
  WITH CHECK (is_home_member(home_id));

CREATE POLICY "Users can update items in their homes"
  ON items FOR UPDATE
  USING (is_home_member(home_id));

-- Inventory transactions: same pattern
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions in their homes"
  ON inventory_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = inventory_transactions.item_id
      AND is_home_member(items.home_id)
    )
  );

CREATE POLICY "Users can insert transactions in their homes"
  ON inventory_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = inventory_transactions.item_id
      AND is_home_member(items.home_id)
    )
  );
```

> **Similar policies needed for:** homes, user_homes, categories, item_categories, shopping_list_items, notifications, device_tokens. All follow the `is_home_member()` pattern.

### Storage RLS

Item photos live in a Supabase Storage bucket and need their own policies — **table RLS does not cover them**, and the default is more permissive than we want. Photos are scoped to home membership via the object path (`{home_id}/{item_id}/{filename}`).

---

## 5. Data Layer: Cache, Persistence, Offline & Status UI

**There is no sync engine.** After scoping the offline bar (below), the offline surface is a
cached read model plus one queued boolean — nothing left for a sync engine to do. The stack is
TanStack Query v5 + `supabase-js` + a hand-written Realtime bridge, with zero added
infrastructure.

### 5.1 The offline bar

`"I put Red Bull in the cart"` and `"we now have 24 Red Bulls"` are two different facts about
two different moments. Separating them is what makes this layer small.

|              | Acquisition intent                        | Inventory truth    |
| ------------ | ----------------------------------------- | ------------------ |
| Where        | Store aisle                               | Kitchen, unpacking |
| Connectivity | Patchy — the whole reason offline matters | Always good        |
| Precision    | None — just "got it"                      | Exact quantity     |
| Data         | Boolean on a shopping-list row            | Ledger append      |

1. **Offline reads — universal.** Not scoped per view. Once `items`, `categories`,
   `shopping_list_items` and `homes` are cached, every screen reading them works offline by
   default. Restricting it per-view would mean _adding_ network checks that otherwise would not
   exist.
2. **Offline writes — the shopping-list check-off only.** A boolean on a ~20-row table, LWW,
   conflict-free even in principle (two people ticking the same row produce the same result).
   **Native only** — see §5.4.
3. **Ledger writes — online only in v1.** Because the ledger is never written offline, there is
   no optimistic `current_inventory` to reconcile against the server's trigger-derived value.
   That reconciliation is the expensive part of offline write support, and it buys nothing for
   the moment that actually needs offline.
4. **Blocked with a visible reason:** barcode → Open Food Facts lookup, photo upload,
   home/membership operations, item transaction history.

**Hard constraint, binding on every decision below: optimistic-but-silent is forbidden.** A
write that appears to succeed and silently does not is worse than one refused up front. Refusals
are **pre-emptive** (disabled control plus reason), never attempted-then-refused.

The offline-critical read model is roughly **100KB at 500 items** and never touches the ledger.

> **Not v1:** warehouse / office / detached-storage deployments, where the unpack session may
> itself be offline. v1 targets the household case.

### 5.2 The ledger stays out of client state

**No transaction rows are synced or persisted on the device.** The store aisle needs only
`current_inventory` and `updated_at`, both already columns on `items`. "When did we last buy
laundry soap" is answered by `updated_at`, not a ledger query. Derived columns
(`typical_days_between_purchases`, purchases-in-last-N-months) were offered and declined for v1.

This removes the only unbounded table from the client. Remaining cache size is bounded by how
many distinct items a household can physically own.

**The 90-day transaction window is deleted.** It existed only to bound client memory under an
in-memory sync engine. Full history is retained **forever, server-side** — it costs nothing and
keeps future trend features possible.

**Item history is an online-only read path:** a button opening a bottom sheet showing roughly
the **last 10 updates**, fetched live via `supabase-js`, memory-only (not in the persistence
allowlist). Not full history, not offline, not synced. Graphs and trends are deferred.

Read-path cost is nil: `current_inventory` is a denormalized column, so the list query is a
single indexed scan of `items` with no aggregation and no join. Write-path cost is O(n) in one
item's history because the trigger recomputes `SUM(quantity_changed)` from scratch —
**deliberately not** optimized to `current_inventory + NEW.quantity_changed`, because the
incremental form can silently drift and never self-corrects while the full recompute is
self-healing.

```sql
-- required by the trigger's soft-delete filter
CREATE INDEX ON inventory_transactions (item_id) WHERE deleted = false;
```

### 5.3 Query keys, cache lifetime, and Realtime

> **Canonical:** [`docs/query-keys.md`](docs/query-keys.md) + the factory in
> `apps/supplystash/state/query-keys.ts`. Keep this section and that page in sync; the page wins.

**`homeId` is part of every query key** — `['items', homeId]`, `['shoppingList', homeId]`, never
one key per table invalidated on switch. The reason is not the switch-back spinner; it is that a
bare `['items']` key **does not describe the data it holds**. On cold start you would rehydrate a
blob with no way to know whose items are in it, forcing a compare-and-discard against
`currentHomeId` that must be remembered and can be got wrong. RLS cannot catch this: every cached
byte is data the user is entitled to, so home A's rows rendering under home B's header is a
**correctness** failure, not a security one, and nothing server-side sees it.

```ts
// state/items.ts — all data access is insulated behind our own hooks
export function useItems() {
  const homeId = useCurrentHomeId();
  return useQuery({
    queryKey: ["items", homeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("home_id", homeId)
        .eq("deleted", false);
      if (error) throw error;
      return data;
    },
    enabled: !!homeId,
  });
}
```

Cache lifetime:

| Option      | Value                   | Why                                                                                                                                                                                                                                    |
| ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staleTime` | **`0`** (default)       | Everything is immediately stale, so refetch-on-mount/focus/reconnect are all live. Focus-refetch is the self-heal for a dropped Realtime socket. Stale-while-revalidate means a Realtime-triggered refetch is never a visible spinner. |
| `gcTime`    | `Infinity`              | Must be ≥ `maxAge`, or queries are collected in memory and never reach disk.                                                                                                                                                           |
| `maxAge`    | `Infinity`              | Age never discards data. A 24h default would show an empty list to someone who last opened the app on Tuesday and shops on Thursday — violating §5.1.                                                                                  |
| `buster`    | schema-version constant | The **only** intended mechanism for discarding a persisted cache.                                                                                                                                                                      |

**Realtime → `invalidateQueries`. Invalidate, never patch.** ~15 lines per table:

```ts
// state/useRealtimeBridge.ts
useEffect(() => {
  if (!homeId || !session) return;
  const channel = supabase
    .channel(`home:${homeId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "items", filter: `home_id=eq.${homeId}` },
      () => queryClient.invalidateQueries({ queryKey: ["items", homeId] }),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [homeId, session]); // ← both deps are load-bearing
```

The `[homeId, session]` dependency array is a hard requirement, not a detail: a bridge that never
re-subscribes on home or auth change is exactly the bug that disqualified `supabase-cache-helpers`
(§5.7). `invalidateQueries` defaults to `refetchType: 'active'`, so an event for a screen nobody
is looking at costs nothing until next mount.

**Why this is wiring and not a reinvented sync engine:** Supabase Realtime does the hard part —
WAL decode, RLS, fan-out, reconnect. The bridge only says "a row changed, mark this key stale."
The reinvention risk lives entirely on the _patching_ path (re-implementing PostgREST filter and
ordering semantics in JS), which is precisely what we refuse. It is also the most deletable piece
in the stack: remove it and the app degrades to refetch-on-mount/focus/reconnect, which already
works.

### 5.4 Persistence: two persisters, split by concern

> **Canonical:** [`docs/persistence.md`](docs/persistence.md). Note the two-layer split: the
> auth-session store (`LargeSecureStore`, shipped) is unrelated to the query-cache persister
> below (Project 4). `expo-sqlite` is installed but unwired pending Project 4.

**`expo-sqlite/kv-store` on native; no persistence on web.**

Native backend: both `react-native-mmkv` and `expo-sqlite/kv-store` expose a sync read API and
are indistinguishable on performance for this access pattern (a ~100KB blob on a throttle, off
the hot path — the `+/-` tap is an online mutation plus an invalidation, not a persist write).
That leaves dependency risk, and `expo-sqlite` wins it: it is inside Expo's own module set and
upgrades on the SDK cadence we already take. Bare AsyncStorage is rejected — async-only, and
SQLite-backed on Android anyway.

Two persisters, because one cannot do both jobs:

| Concern                   | Mechanism                                                                                                         | Shape on disk                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Read cache, **all homes** | `experimental_createQueryPersister` (`@tanstack/query-persist-client-core`) as `defaultOptions.queries.persister` | one entry per query hash (`prefix-queryHash`) |
| Paused check-off queue    | `persistQueryClient` with `dehydrateOptions.shouldDehydrateQuery: () => false`                                    | one small blob, mutations only                |

The per-query persister is what makes "keep every home forever" affordable. `persistQueryClient`
rewrites the **entire** dehydrated cache on every change — at ~100KB/home, seven homes is ~700KB
written on every check-off. The fine-grained persister rewrites one entry (~KB), so **write cost
is flat in home count**.

It is **queries-only** — verified; there is no mutation equivalent, and every documented route
for persisting paused mutations goes through `persistQueryClient`/`dehydrate`. Adopting it alone
would silently drop the queued check-off. Hence the split: `shouldDehydrateQuery: () => false` is
the seam, and whole-blob rewriting is free there because the blob is a handful of queued booleans.

**Allowlist, not denylist.** The persister's `filters` option persists **only** `items`,
`categories`, `shopping_list_items`, `homes`. Everything else — the history modal, barcode
lookups — is memory-only. With a denylist the default would be "persist", so a query added six
months from now ships to disk unless someone remembers to exclude it, and the failure mode is
silent: a gradually slower cold start.

**Accepted risk: `experimental_`.** Same smell that disqualified Legend-State and
`supabase-cache-helpers`, and the difference is stated rather than assumed — it is first-party
TanStack core rather than a bus-factor-1 side project, and it has a **named stable fallback that
is a config change, not a rewrite**: plain `persistQueryClient` with persistence scoped to the
active home only. Blast radius is `state/*.ts` (see §5.8).

**Web: no persistence at all.** `kv-store` _does_ run on web (wa-sqlite WASM in a Web Worker,
persisted to OPFS), but its sync API there needs `SharedArrayBuffer` — i.e. COOP/COEP headers a
static export does not set — and it would ship a WASM SQLite build to hold one JSON blob.
`idb-keyval`/IndexedDB was rejected on **support surface**, not bytes: Safari private-mode
failures, ITP 7-day eviction, quota errors. The web query cache is memory-only; refresh means
refetch. Consequence: **the shopping-list check-off is online-only on web** — an offline-paused
mutation would live in memory and vanish on refresh, exactly the silent failure §5.1 forbids.
(`beforeunload` warnings were considered and rejected: unreliable and dismissible, so they dress
up the same silent failure.) Side benefit: persisted paused mutations are a native-only concern.

**Cold start:** `expo-splash-screen` `preventAutoHideAsync()` at boot, hidden once **all three**
local reads settle — Supabase auth session restore, `currentHomeId` resolution, and cache
rehydration (`useIsRestoring()` false). All three are local, so the hold is milliseconds.
Without it there is a flash of empty-then-populated, which in a store aisle reads as "my list is
gone."

### 5.5 Multi-home: every home cached, forever

**Multi-home switching ships in v1, on the free tier.** Monetization is charged at the **home**
level — the person who creates a home pays to raise its seat count — so the free-tier cap is on
homes you **create**, not homes you **join**. A free user can be invited into unlimited homes,
each paid for by its own owner. Multi-home is therefore a day-one reality with no payment
infrastructure in the stack.

- **Every home the device has ever fetched stays cached and persisted, forever.** The principle:
  _if the server gave it to us, keep it; stale data beats no data._ Affordable only because of
  the per-query persister in §5.4.
- **Only the active home holds a Realtime channel.** Inactive homes freeze at last fetch. That is
  the accepted deal.
- **Switching offline to a home with cached data** succeeds and shows stale rows under the
  existing offline banner with its age suffix. No new UI — the "two months out of date" case is
  already a solved presentation problem (§5.6).
- **A home never fetched on this device** is listed in the switcher but **disabled**: _"Not
  downloaded — needs a connection."_ Pre-emptive refusal, per §5.1.
- **Realtime on switch:** old channel down → active `homeId` flips → new channel up. **No manual
  invalidate** — `staleTime: 0` means switching back to a long-stale home refetches on mount by
  itself.
- **Paused mutations are per-account, not per-home.** A check-off queued offline in home A
  survives a switch to home B and a force-quit, and resumes on reconnect regardless of the active
  home — it carries its own row id. `resumePausedMutations()` needs no home awareness. The
  pending-count footer (§5.6) is scoped to the **active** home so the user never sees counts for a
  home they are not in.

### 5.6 Sync status UI

**Quiet hybrid: chrome only when abnormal, row marks only while abnormal, nothing at all when
everything is fine.** The banner owns _connectivity_; the row owns _this item's write_. Neither
duplicates the other.

| State                              | Native                                                                                                                          | Web                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Everything fine                    | No chrome whatsoever                                                                                                            | Same                                                                         |
| Offline                            | Dark top banner: _"Offline — changes will sync when the connection is reestablished."_ Age appended if `dataUpdatedAt` > 3 days | _"Offline — you can't change values until the connection is reestablished."_ |
| Check-off queued                   | Row: greyed label + small amber dot. Footer: same amber dot + _"N items will sync when you reconnect."_                         | n/a — checkbox is disabled                                                   |
| Queued write **rejected** at flush | One-time toast naming the cause; row reverts to server truth; nothing lingers                                                   | n/a                                                                          |
| Queued write fails **transiently** | Nothing. The amber dot stays while TanStack retries                                                                             | n/a                                                                          |
| Refetch failing while online       | Amber bar: _"Can't reach the server — showing your last saved list."_ + Retry                                                   | Same                                                                         |
| Ledger write at home, offline      | Stepper **disabled**; footer _"Counts are read-only until you're back online."_                                                 | Same                                                                         |

- **One colour means one thing.** The footer dot is the same amber as the row dot deliberately —
  the footer is a _count of the dots above it_, not a separate concept.
- **There is no persistent "failed" row and no per-row Retry affordance.** Nothing can fail
  _while_ offline; an offline check-off is a paused mutation, not an attempted one. Failure exists
  only at flush, in two classes: **transient** (5xx, timeout, flaky reconnect) — TanStack retries,
  self-heals, no UI; and **permanent** (row deleted by another member, RLS denies after removal
  from the home, `home_id` moved) — these can never succeed on retry, so a Retry button would be a
  lie that re-fires into the same state. One toast, row reverts.
- **Staleness is not its own concept.** TanStack refetches on mount and focus, so genuinely
  online-and-stale lasts milliseconds. The realistic "online but 5 days old" case — captive-portal
  WiFi, a dead refresh token, Supabase down — is a _refetch is failing_ problem, and naming the age
  points the user at the wrong thing. So age rides on the **offline** banner (where the user
  genuinely cannot fix it), and online-and-old becomes the **"can't reach the server"** bar with a
  Retry. `maxAge: Infinity` stays safe because data is never silently presented as current: either
  the offline banner is up, or the unreachable bar is.

Two implementation requirements fall out:

- A query-level **"refetch is failing" signal distinct from NetInfo** — consecutive `isError` on
  the synced-table queries, not `navigator.onLine`. This is the captive-portal detector and has no
  other source.
- The paused-mutation error handler must **keep the PostgREST error code**, so rejection toasts can
  distinguish a deleted row from an RLS denial.

### 5.7 Conflict resolution

Last-write-wins per record. That is a thin conflict story, and it is sufficient because the data
model was designed to avoid conflicts rather than resolve them.

| Data                                            | Conflict behavior     | Why it's safe                                                                                                                |
| ----------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `inventory_transactions`                        | **None possible**     | Append-only inserts with client-generated UUIDs. Two members logging `-1` produce two distinct rows. Nothing is overwritten. |
| `items.current_inventory`                       | **None possible**     | Server-derived by trigger. No client ever writes it.                                                                         |
| `items` metadata (title, warning_amount, photo) | Last write wins       | Two members editing the same threshold: the later write wins. Correct and unsurprising for a household.                      |
| `shopping_list_items.is_checked`                | Last write wins       | Checking an already-checked item is idempotent in practice.                                                                  |
| Homes / memberships                             | **N/A — online only** | See below.                                                                                                                   |

**Explicitly not solved, and deliberately so:** duplicate logging (both partners log the same
consumption). This is a _product_ problem — the transaction history makes it visible and a
`correction` transaction resolves it. UX deferred past v1.

**Online-only operations.** Home creation, invites, membership changes, and role changes go
through **Supabase RPCs**. Low-frequency, need server-side validation, no meaningful offline use
case. Inventory reads stay offline-first.

### 5.8 Insulation, revisit triggers, and rejected alternatives

**All data access is insulated behind our own `state/` hooks.** No component imports
`supabase-js` or `useQuery` directly. Every decision in this section is therefore replaceable
inside `state/` without touching the UI, which is what keeps the `experimental_` risk in §5.4 and
the whole no-sync-engine bet cheap to reverse.

**Two named triggers to revisit the no-sync-engine decision:**

1. **Offline ledger writes become a requirement** — §5.1's central assumption breaks and the
   optimistic-reconciliation problem returns.
2. **_Measured_** **performance pain at 500+ items** — measured, not anticipated. This is a
   render-path question (list virtualization, re-render scope), not a storage one.

**Refetch-burst escape ladder**, named so it is not improvised later. The risk is a partner's
unpack session firing 30 events into 30 full-list refetches on cellular.

0. **Ship with no debounce.** Single-event latency is not user-visible (stale-while-revalidate
   plus a nil-cost indexed read).
1. **~500ms coalescing timer** on the invalidation — ~5 lines, preserves invalidate-never-patch.
   Reach for this when an unpack session actually feels bad (trigger 2 above).
2. **Targeted `setQueryData` for scalar updates** — a `current_inventory` change on a row already
   in cache alters neither filtering nor ordering, so it is far narrower than general patching.
   Still the first step down the road we walked away from.
3. **Delta refetch** on `updated_at > lastSeen` with a merge. This is where the banked
   soft-delete/timestamp columns (§3) earn out — and it is honestly the beginning of writing a
   sync engine. Trigger 1 in disguise.

**Fallback for the whole layer:** the design is already the fallback. There is no sync engine to
lose, and every rung above is a change inside `state/` with **zero backend changes**.

#### Rejected alternatives

| Rejected                                                    | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Legend-State v3** (`@legendapp/state` + `syncedSupabase`) | Not a beta-risk rejection so much as a _dissolved requirement_: once the ledger left client state and the offline surface shrank to one boolean, there was nothing for a sync engine to do. Separately: every persist plugin **rewrites the entire table blob on every change** (verified in source), so cost tracks total store size rather than change size — a `+1` tap would cost ~500KB of synchronous writes. v3 has been in beta ~18 months / ~25 betas with no stable timeline, and bus factor is 1.                                                                                  |
| **`supabase-cache-helpers`**                                | Three independent disqualifiers, verified in source: it _patches_ the cache (re-implementing PostgREST filter semantics in JS) rather than invalidating; it has **zero `mutationKey` usage**, making persisted paused mutations impossible and killing force-quit write durability; and RFC #667 has the maintainer planning to delete offline cache mutation entirely in v2, converging on the design chosen here. Bus factor 1. Its subscription hooks also use `[]` dependency arrays and never re-subscribe on auth/home change — the bug §5.3's `[homeId, session]` deps exist to avoid. |
| **`react-native-mmkv`**                                     | Lost the performance axis when that axis stopped mattering (§5.4). Pure third-party native-module dependency risk against an in-SDK alternative. Doc-only commitment; switching cost was zero.                                                                                                                                                                                                                                                                                                                                                                                                |
| **The 90-day transaction sync window**                      | Existed solely to bound an in-memory ledger. The ledger is no longer on the client (§5.2), so there is nothing to bound. Full history stays server-side forever.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **PowerSync**                                               | $588/yr (Pro). Free tier is a _development_ tier: 50 peak concurrent connections is reachable on a launch weekend, and free projects deactivate after 1 week idle.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **RxDB**                                                    | $1,188/yr (Pro). Production RN SQLite storage is premium-only; the free build caps at 500 documents and is explicitly not for production.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Electric**                                                | Read-path sync only; writes and offline persistence are yours to build. Wrong shape for "lightweight, move fast."                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Triplit**                                                 | Acquired by Supabase Oct 2025, not integrated, domain parked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Zero / InstantDB / LiveStore**                            | Would discard the Postgres schema, RLS, and Edge Functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## 6. Edge Functions

Supabase Edge Functions (Deno/TypeScript) handle logic that shouldn't run client-side:

### Barcode Lookup

```
POST /functions/v1/barcode-lookup
Body: { barcode: "3017624010701" }

1. Query Open Food Facts API: GET https://world.openfoodfacts.org/api/v2/product/{barcode}
2. Also try Open Products Facts for non-food items
3. Return: { name, image_url, category_suggestion }
4. Client pre-fills the "Add Item" form
```

### Low-Stock Notification Trigger

```
-- Postgres trigger fires when current_inventory changes:
-- IF current_inventory <= warning_amount AND previous value > warning_amount
--   → call Edge Function via pg_net or database webhook

POST /functions/v1/send-low-stock-notification
1. Look up all home members for the item's home
2. Look up Expo push tokens from `device_tokens`
3. POST https://exp.host/--/api/v2/push/send
   Body: [{ to: "ExponentPushToken[...]", title: "Running low!", body: "Paper Towels is running low" }]
4. Expo handles delivery to both APNs (iOS) and FCM (Android)
```

> **No Firebase project required.** Expo Push fronts both platforms with one API and one credential. This removes the entire Firebase dependency from the previous architecture.

### Shopping List Generation

```
POST /functions/v1/generate-shopping-list
Body: { home_id: "..." }

1. Query items WHERE current_inventory <= warning_amount AND NOT is_archived
2. Create shopping_list_items for each
3. Return the list
```

### Home / Membership RPCs (online-only)

Postgres functions (`SECURITY DEFINER`) rather than Edge Functions where possible — creating a home, generating an invite, accepting an invite, changing a member's role, removing a member.

---

## 7. Screens (v1)

### 1. Home Dashboard

- Summary cards: X items out of stock, Y items running low
- Recent activity feed ("Alex: -1 Paper Towels, 5 min ago")
- Quick actions: generate shopping list, scan barcode to add item

### 2. Inventory List

- Filterable by status: out of stock, low, fine, all
- Searchable by name
- Category filter chips
- Inline +/- buttons for quick count adjustments
- Tap item → Item Detail

### 3. Item Detail

- Photo (from barcode lookup or user upload)
- Current count, warning threshold (editable)
- Transaction history — **online-only**, a bottom sheet with roughly the last 10 updates (§5.2)
- Edit item metadata
- Archive/delete

### 4. Add Item

- Barcode scanner via `expo-camera` (native only) → Open Food Facts lookup
- Manual entry fallback (and the only path on web)
- Category assignment
- Set initial quantity and warning threshold

### 5. Shopping List

- Generated from low/out-of-stock items, or manually added
- Checkable items (checked items move to bottom / fade)
- Synced across household members in real-time
- Checking an item optionally creates an inventory transaction ("purchased")

### 6. Settings / Home Management

- Home name, invite members (via link or email) — online only
- Member list with roles — v1 shows Owner and Member; the schema carries five (§3), so the role picker can grow without a migration
- Account settings, notification preferences
- **Home switcher — v1, free tier.** Homes you have joined are listed; a home never fetched on this device is disabled offline with "Not downloaded — needs a connection" (§5.5)
- (Future) subscription management

---

## 8. Web Strategy

Web ships at launch via **React Native Web**, from the same codebase, with a responsive layout that works on a desktop screen.

### Responsive Layout

Three mechanisms, in order of preference:

1. **Uniwind breakpoints** (`sm:` / `md:` / `lg:`) — these work on native as well as web, driven by window width. Handles ~90% of it.
2. **`useWindowDimensions()`** — when the layout choice drives logic, not just styles (master-detail split vs. push a route).
3. **`Platform.OS === 'web'`** — for genuinely web-only branches.

```tsx
<View className="flex-1 flex-col md:flex-row">
  <View className="hidden md:flex md:w-64">{/* sidebar: tablet + desktop */}</View>
  <View className="flex-1">{/* inventory list */}</View>
</View>
<View className="flex md:hidden">{/* bottom tabs: phone only */}</View>
```

A tablet in landscape crosses `md` and gets the desktop layout for free — no separate tablet branch.

### Deliberately Degraded on Web

Web is a **read-and-adjust** surface. Full features require the app, and that is an honest thing to say in marketing copy.

| Feature                                          | Web                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Inventory browse, +/- adjustments, shopping list | Yes                                                                                                                    |
| Realtime updates across members                  | Yes                                                                                                                    |
| Barcode scanning                                 | **No** — `expo-camera` scanning is native-only. Manual entry instead.                                                  |
| Push notifications                               | **No** — no PWA manifest, service worker, or web-push for v1. In-app notification state only.                          |
| Offline persistence                              | **No** — the web query cache is memory-only; refresh means refetch. IndexedDB/OPFS rejected on support surface (§5.4). |
| Offline shopping-list check-off                  | **No** — disabled when offline with an honest reason, since a paused mutation would vanish on refresh.                 |

---

## 9. Monetization

### Philosophy

The free tier is a complete, good product. Nobody feels punished. Paid tier adds value at scale.

### Free Tier

- 1 home **that you create** — joining homes is **unlimited**, because each home is paid for by its owner (§5.5)
- Up to 3-4 members in a home you own
- Unlimited items (soft cap ~500 per home for abuse prevention)
- Full inventory tracking, ledger, shopping lists
- Push notifications for low stock
- Barcode scanning + Open Food Facts auto-fill
- Offline support

### Paid Tier (~$2-4/mo or $20-30/yr)

- Additional homes **you create** (vacation house, office, etc.)
- Larger seat count on homes you own (5+ members)
- Bulk import (CSV/spreadsheet)
- Analytics & trends ("you use 4 rolls of paper towels/month")
- Predictive restocking ("you'll probably need coffee in 5 days")

### v1 Approach

Don't build payment infrastructure yet. Ship the free app, get real usage data, validate the paid features with actual user behavior. **Because the sync layer adds no infrastructure cost, there is no floor of recurring spend to cover before the app breaks even** — Supabase's free tier covers early usage entirely.

---

## 10. Product Image Strategy

### Layer 1: Barcode Scan → Auto-fill (primary)

- User scans barcode via `expo-camera`
- Edge Function queries Open Food Facts / Open Products Facts API
- Returns product name, image URL, category suggestion
- Pre-fills the Add Item form — satisfying UX, no UGC

### Layer 2: Category Icons (fallback)

- Items without a barcode match get a category-based icon
- Small curated set: cleaning, food, bathroom, kitchen, etc.

### Layer 3: User Photo Upload (optional)

- User can snap a photo → stored in Supabase Storage
- Only visible to household members (not public-facing), enforced by Storage RLS
- UGC moderation risk is negligible in a household context
- Revisit moderation if images ever become cross-household visible

> **Photos never enter the sync layer.** Only `photo_url` syncs; the image itself is fetched from Storage on demand and cached by the image component.

---

## 11. Deployment & Repo Layout

```
supply-stash/
├── apps/
│   └── supply-stash/              # Expo app
│       ├── app/                   # Expo Router (file-based routes)
│       │   ├── _layout.tsx        # root shell: tabs on phone, sidebar on desktop
│       │   ├── (tabs)/
│       │   └── item/[id].tsx
│       ├── components/            # RNR-based components
│       ├── state/                 # the ONLY data-access surface: query hooks,
│       │                          # mutations, persisters, Realtime bridge
│       ├── lib/                   # supabase client, kv-store, push registration
│       ├── global.css             # Uniwind / Tailwind v4 layer (no tailwind.config.js —
│       │                          # Tailwind v4 is configured in CSS)
│       ├── uniwind-types.d.ts     # generated by the Uniwind Metro plugin
│       └── app.config.ts
├── packages/
│   └── types/                     # Shared TypeScript types, generated Supabase types
├── supabase/
│   ├── migrations/                # SQL migrations (ledger-first schema, RLS, triggers)
│   ├── tests/                     # pgTAP tests
│   ├── functions/                 # Edge Functions
│   └── config.toml
└── pnpm-workspace.yaml
```

### Client Configuration Notes

- **Supabase auth storage** — `supabase-js` needs an explicit storage adapter on RN (`expo-secure-store` for tokens) and `detectSessionInUrl: false` on native
- **Deep links** — one URL scheme + universal links serves both the OAuth callback and household invite links. Set up early; retrofitting after the invite flow exists is painful.

### Builds

```bash
# Native (dev)
npx expo run:ios / run:android      # dev build (required — expo-sqlite is a native module)

# Native (release)
eas build --platform all
eas submit

# OTA
eas update --branch production

# Web
npx expo export --platform web       # → deploy static output to Vercel/Netlify/Cloudflare
```

### Database Workflow

**All SQL lives in migration files.** No changes via the Supabase dashboard — everything auditable in git.

CI gates on every migration PR:

- **squawk** — migration linting (blocking locks, unsafe column changes)
- **pgTAP** — RLS policy tests, trigger correctness, ledger math

---

## 12. Decisions Log

| Decision                                 | Choice                                                                                                                                                                                                                                                                                                               | Rationale                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework                                | Expo + React Native, Expo Router                                                                                                                                                                                                                                                                                     | Full commitment to the Expo ecosystem for velocity; one codebase for iOS, Android, web                                                                                                                                                                                                                                         |
| UI Components                            | React Native Reusables + **Uniwind**                                                                                                                                                                                                                                                                                 | Tailwind classes shared across native and web; simpler than Tamagui, fast to move in                                                                                                                                                                                                                                           |
| Backend                                  | Supabase all-in (no custom server)                                                                                                                                                                                                                                                                                   | RLS for authz, Edge Functions for server logic, Storage for photos, Realtime for live updates                                                                                                                                                                                                                                  |
| Data Layer                               | **TanStack Query v5 + `supabase-js` + a hand-written Realtime→`invalidateQueries` bridge. No sync engine.**                                                                                                                                                                                                          | **$0 infrastructure.** Once the ledger left client state and the offline surface shrank to one queued boolean, a sync engine had nothing to do. Invalidate, never patch. §5                                                                                                                                                    |
| — rejected: NativeWind                   | Superseded by Uniwind (migrated 2026-08-16). NativeWind is still on Tailwind v3 and does its style resolution at runtime; Uniwind targets Tailwind v4 and compiles through a Metro plugin, so class strings resolve at build time. Same authoring model, so the migration was a config + import swap, not a rewrite. |                                                                                                                                                                                                                                                                                                                                |
| — rejected: Legend-State v3              | Requirement dissolved; whole-blob persist; bus factor 1                                                                                                                                                                                                                                                              | §5.8                                                                                                                                                                                                                                                                                                                           |
| — rejected: `supabase-cache-helpers`     | Patches instead of invalidating; no `mutationKey` (kills durable writes); maintainer deleting offline mutation in v2                                                                                                                                                                                                 | §5.8                                                                                                                                                                                                                                                                                                                           |
| — rejected: PowerSync                    | $588/yr (Pro)                                                                                                                                                                                                                                                                                                        | Best-in-class, SQLite-backed, SQL queries. Free tier is a _development_ tier: 50 peak concurrent connections is reachable on a launch weekend (onboarding sessions are 20–40 min, not 30 s), and free projects deactivate after 1 week idle. Pro at $49/mo removes all of it, but that is a hard commitment pre-revenue.       |
| — rejected: RxDB                         | $1,188/yr (Pro)                                                                                                                                                                                                                                                                                                      | Production RN SQLite storage is premium-only; the bundled free version caps at 500 documents and is explicitly not for production. Strictly worse on cost than PowerSync.                                                                                                                                                      |
| — rejected: Electric                     | Assembly cost                                                                                                                                                                                                                                                                                                        | Read-path sync only; writes and offline persistence are yours to build. Wrong shape for "lightweight, move fast."                                                                                                                                                                                                              |
| — rejected: Triplit                      | Dead                                                                                                                                                                                                                                                                                                                 | Acquired by Supabase Oct 2025, not integrated, domain parked.                                                                                                                                                                                                                                                                  |
| — rejected: Zero / InstantDB / LiveStore | Backend rewrite                                                                                                                                                                                                                                                                                                      | Strong at multi-user realtime but want to own the backend. Would discard the Postgres schema, RLS, and Edge Functions.                                                                                                                                                                                                         |
| Local Persistence                        | **`expo-sqlite/kv-store` on native; none on web**                                                                                                                                                                                                                                                                    | Performance axis died with the sync engine, leaving dependency risk — and `expo-sqlite` rides Expo's own SDK cadence. MMKV rejected on that basis (doc-only, zero switching cost). §5.4                                                                                                                                        |
| Persister Split                          | `experimental_createQueryPersister` for reads (one entry per query) + `persistQueryClient` with `shouldDehydrateQuery: () => false` for the paused-mutation queue                                                                                                                                                    | Per-query writes are flat in home count, which is what makes "keep every home forever" affordable. The fine-grained persister is queries-only, so the mutation queue needs the second one. **Fallback if `experimental_` breaks: plain `persistQueryClient` scoped to the active home — a config change, not a rewrite.** §5.4 |
| Offline Bar                              | Reads universal; **the shopping-list check-off is the only offline write**; ledger writes online-only                                                                                                                                                                                                                | Acquisition intent (store, patchy signal, a boolean) is a different fact from inventory truth (kitchen, good signal, a ledger append). Removes optimistic `current_inventory` reconciliation from v1 entirely. §5.1                                                                                                            |
| Membership Roles                         | **Five in the schema (`owner`/`admin`/`member`/`contributor`/`viewer`), two in the v1 UI**                                                                                                                                                                                                                           | Widening a role CHECK against a populated `user_homes` means a migration, a backfill, and re-auditing every policy. RLS enforces all five now; the UI exposes Owner/Member until a screen needs more. §3                                                                                                                       |
| `current_inventory` Writability          | **Revoked from `authenticated` on both INSERT and UPDATE, plus a guard trigger**                                                                                                                                                                                                                                     | "Clients never write it" was doctrine the schema did not enforce — RLS gates rows, not columns. Privileges stop normal clients; the trigger stops `service_role` and SECURITY DEFINER paths. A new item opens at 0 and its starting count comes from an opening ledger row. Migration `…0005`                                  |
| Ledger on Client                         | **Not synced, not persisted**                                                                                                                                                                                                                                                                                        | The store aisle needs only `current_inventory` and `updated_at`, both already columns on `items`. Removes the only unbounded table from the client. History is an online-only ~10-row modal. §5.2                                                                                                                              |
| Query Keys                               | `homeId` in **every** key                                                                                                                                                                                                                                                                                            | A bare key does not describe its data, and RLS cannot catch cross-home rendering because all cached data is data the user is entitled to. §5.3                                                                                                                                                                                 |
| Multi-home                               | **v1, free tier.** Every home ever fetched is cached forever; only the active home holds a Realtime channel                                                                                                                                                                                                          | Monetization is per _home_ (its owner pays for seats), so joining homes is unlimited on the free tier. §5.5                                                                                                                                                                                                                    |
| Sync Status UI                           | Quiet hybrid: chrome only when abnormal, row marks only while abnormal, nothing when fine. **Pre-emptive refusals, no Retry affordance on rows**                                                                                                                                                                     | Optimistic-but-silent is forbidden; nothing can fail _while_ offline, and flush failures are either transient (retried, no UI) or permanent (retry would be a lie). §5.6                                                                                                                                                       |
| Revisit Triggers                         | (1) offline ledger writes become a requirement; (2) **_measured_** pain at 500+ items                                                                                                                                                                                                                                | Named up front so re-opening the no-sync-engine decision is evidence-driven, not vibes. §5.8                                                                                                                                                                                                                                   |
| Push Notifications                       | **Expo Push (EAS)**                                                                                                                                                                                                                                                                                                  | One API fronting both APNs and FCM. **Firebase dependency removed entirely.**                                                                                                                                                                                                                                                  |
| Data Model                               | Ledger-first (append-only transactions)                                                                                                                                                                                                                                                                              | Conflict-free writes. Load-bearing: it is _why_ last-write-wins is sufficient and no sync engine is needed.                                                                                                                                                                                                                    |
| — rejected: 90-day sync window           | **Deleted.** Existed only to bound an in-memory client ledger; the client holds no ledger. Full history stays server-side forever. §5.2                                                                                                                                                                              |
| Conflict Resolution                      | Last-write-wins on metadata; append-only elsewhere                                                                                                                                                                                                                                                                   | Ledger inserts cannot conflict. `current_inventory` is server-derived. Only item metadata is LWW, which is fine for a household.                                                                                                                                                                                               |
| Home / Membership Ops                    | Online-only RPCs                                                                                                                                                                                                                                                                                                     | Low-frequency, need server-side validation, no offline use case. Inventory ops stay offline-first.                                                                                                                                                                                                                             |
| Barcode Scanning                         | `expo-camera` (native only)                                                                                                                                                                                                                                                                                          | Built into Expo; closes the previous open question about which plugin to use                                                                                                                                                                                                                                                   |
| Web                                      | React Native Web at launch, degraded features                                                                                                                                                                                                                                                                        | Same codebase, responsive via Uniwind breakpoints. No scan, no push, **no persistence**, and the check-off is online-only. §5.4                                                                                                                                                                                                |
| Analytics                                | Skip for v1                                                                                                                                                                                                                                                                                                          | Add PostHog or Plausible later based on actual need                                                                                                                                                                                                                                                                            |
| Crash Reporting                          | Skip for v1                                                                                                                                                                                                                                                                                                          | Add Sentry later                                                                                                                                                                                                                                                                                                               |

---

## 13. Open Questions / Future Decisions

- **Duplicate-logging UX:** both partners log the same consumption. The ledger makes it visible; the product answer (prompt? auto-detect? just show history?) is undecided.
- **Shopping list → inventory loop:** when a user checks off a shopping list item, auto-create an inventory transaction? What quantity — confirm or assume?
- **Transaction archival:** the client holds no ledger at all (§5.2). Server-side archival of very old transactions is not a v1 concern.
- **Web push / PWA:** deferred past launch. Would need manifest, service worker, and web-push keys.
- **Monetization model:** per-home vs per-seat pricing, one-off vs subscription, and enforcement on lapse are all undecided. Only the _membership cardinality_ is settled (§5.5): a free user may join unlimited homes.
- **Refetch-burst debounce:** shipping with none. §5.8 names the escape ladder; the first rung is a ~500ms coalescing timer, triggered by measured pain rather than anticipation.
- **Unmeasured constant:** the _scaling shape_ of persist writes is confirmed, but the constant (actual ms for a large synchronous `storage.set` on real hardware) was never measured. If a future decision hinges on the constant rather than the shape, run a spike.
- **RNR customization depth:** how far to push a custom brand layer over RNR defaults. Recommend starting with defaults plus a custom color palette and typography, then evolving.
