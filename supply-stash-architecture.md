# Supply Stash — Architecture & Planning Document

_Generated from planning conversation, April 2026_

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

---

## 2. Tech Stack

### Frontend

- **Nuxt** (confirmed) — file-based routing, SSR/SSG for marketing pages, API routes as escape hatch, module ecosystem
- **Tailwind CSS v4** for styling
- **Konsta UI v5** for mobile UI primitives (tab bars, navbars, lists, cards, modals, action sheets) — provides iOS/Material adaptive theming and correct mobile interaction patterns (touch targets, swipe gestures, safe areas)
- **Custom brand layer** on top of Konsta via Tailwind — own color palette, typography, and visual identity to avoid the "generic component library" look
- **NuxtUI** (optional, future) for web-specific pages if a marketing site or web dashboard is added
- **TypeScript** throughout

### Mobile

- **Capacitor** wrapping the Vue web app
- Single codebase, two deployment targets:
  - **Web:** `nuxt generate` → static deploy (Vercel/Netlify)
  - **Mobile:** same build → `npx cap sync` → Xcode/Android Studio → App Store
- Platform-specific behavior via `Capacitor.isNativePlatform()` checks
- Capacitor plugins for: camera (barcode scanning), push notifications, haptics

### Backend (BaaS)

- **Supabase** — all-in, no custom server
  - Postgres database
  - Auth (email/password, OAuth)
  - Row Level Security (RLS) for authorization
  - Edge Functions (Deno/TypeScript) for server-side business logic
  - Realtime for presence/activity indicators
  - Storage for user-uploaded item photos
- **No Hono/Express/custom API server** — the prototype's Hono layer is retired

### Local-First Sync

- **PowerSync** for offline-capable, real-time sync
  - `@powersync/capacitor` SDK — uses **native SQLite** on iOS/Android via `@capacitor-community/sqlite`, falls back to WA-SQLite (OPFS/IndexedDB) on web
  - `@powersync/vue` for reactive composables
  - PowerSync Cloud (free tier) or self-hosted Open Edition
  - Supabase Connector for auth + write upload path

### Architecture Diagram (Conceptual)

```
┌──────────────────────────────────────────┐
│              Nuxt App                    │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │ Konsta UI + │  │  PowerSync Vue   │   │
│  │  Tailwind   │  │   Composables    │   │
│  └─────────────┘  └────────┬─────────┘   │
│                            │             │
│              ┌─────────────▼──────────┐  │
│              │    Local SQLite DB     │  │
│              │   (reads & writes)     │  │
│              └─────────────┬──────────┘  │
└────────────────────────────┼─────────────┘
                             │ background sync
               ┌─────────────▼──────────────┐
               │     PowerSync Service      │
               │  (Cloud or self-hosted)    │
               └─────────────┬──────────────┘
                             │ logical replication
               ┌─────────────▼──────────────┐
               │    Supabase (Postgres)     │
               │  ┌──────┐ ┌─────┐ ┌────┐  │
               │  │ Auth │ │ RLS │ │Edge│  │
               │  │      │ │     │ │Func│  │
               │  └──────┘ └─────┘ └────┘  │
               └────────────┬───────────────┘
                            │ push trigger
               ┌────────────▼───────────────┐
               │  Firebase Cloud Messaging  │
               │     (push only)            │
               └────────────────────────────┘
```

**Data flow:**

1. App reads/writes to local SQLite (instant, works offline)
2. PowerSync syncs local SQLite ↔ Supabase Postgres in background
3. RLS policies enforce authorization at the database level
4. Edge Functions handle server-side logic (barcode lookups, notification triggers, ledger calculations)

---

## 3. Data Model (Ledger-First)

### Key Architectural Decision: Ledger-Based Inventory

Instead of directly mutating a `current_inventory` count, all inventory changes are recorded as **append-only transactions**. The current count is a **derived value** computed from the ledger.

**Why this matters for local-first:**

- Append-only writes never conflict — two household members can independently log changes offline
- Each transaction is an independent fact ("I used 1 paper towel") that doesn't overwrite anything
- The current count is eventually consistent once all transactions sync
- Full audit trail of who changed what and when

### Tables

#### `homes`

```
id            UUID (PK, default random)
name          VARCHAR(255) NOT NULL
description   TEXT
created_at    TIMESTAMP NOT NULL DEFAULT now()
updated_at    TIMESTAMP NOT NULL DEFAULT now()
created_by_id UUID NOT NULL → auth.users
```

#### `user_homes` (junction)

```
user_id       UUID NOT NULL → auth.users
home_id       UUID NOT NULL → homes
role          VARCHAR(50) NOT NULL DEFAULT 'member' -- 'owner' | 'member'
joined_at     TIMESTAMP NOT NULL DEFAULT now()
PK(user_id, home_id)
```

#### `categories`

```
id            UUID (PK, default random)
home_id       UUID NOT NULL → homes  -- categories are per-home
name          VARCHAR(255) NOT NULL
description   TEXT
created_at    TIMESTAMP NOT NULL DEFAULT now()
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
created_at      TIMESTAMP NOT NULL DEFAULT now()
updated_at      TIMESTAMP NOT NULL DEFAULT now()
created_by_id   UUID NOT NULL → auth.users
```

> **Note:** `current_inventory` is a cached/derived value. It's updated by a Postgres trigger or Edge Function whenever a new `inventory_transaction` is inserted. Clients read it for display; the ledger is the source of truth.

#### `item_categories` (junction)

```
item_id       UUID NOT NULL → items
category_id   UUID NOT NULL → categories
PK(item_id, category_id)
```

#### `inventory_transactions` (the ledger — source of truth)

```
id                UUID (PK, default random)
item_id           UUID NOT NULL → items
user_id           UUID NOT NULL → auth.users
quantity_changed  INTEGER NOT NULL       -- positive = add, negative = consume
transaction_type  ENUM('manual_add', 'manual_remove', 'purchase', 'consume', 'correction', 'bulk_import')
notes             TEXT
created_at        TIMESTAMP NOT NULL DEFAULT now()
```

> **Conflict resolution:** Because each transaction is an independent row, there are no write conflicts. If two people both log "-1 paper towels" while offline, both transactions sync to Supabase and the trigger subtracts 2 from the cached count. If one was a duplicate (the "my wife logged it too" scenario), the transaction history makes it visible and a correction transaction can be added.

#### `shopping_list_items`

```
id            UUID (PK, default random)
home_id       UUID NOT NULL → homes
item_id       UUID → items               -- NULL if manually added (not from inventory)
title         VARCHAR(255) NOT NULL       -- denormalized for manual entries
quantity      INTEGER NOT NULL DEFAULT 1
is_checked    BOOLEAN NOT NULL DEFAULT false
checked_by_id UUID → auth.users
created_at    TIMESTAMP NOT NULL DEFAULT now()
checked_at    TIMESTAMP
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
created_at    TIMESTAMP NOT NULL DEFAULT now()
```

#### `device_tokens` (for push notifications via FCM)

```
id            UUID (PK, default random)
user_id       UUID NOT NULL → auth.users
token         TEXT NOT NULL              -- FCM device token
platform      VARCHAR(20) NOT NULL       -- 'ios' | 'android' | 'web'
created_at    TIMESTAMP NOT NULL DEFAULT now()
updated_at    TIMESTAMP NOT NULL DEFAULT now()
UNIQUE(user_id, token)
```

### Postgres Trigger: Ledger → Cached Count

```sql
CREATE OR REPLACE FUNCTION update_item_inventory()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE items
  SET current_inventory = (
    SELECT COALESCE(SUM(quantity_changed), 0)
    FROM inventory_transactions
    WHERE item_id = NEW.item_id
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

All data access is scoped through home membership. A user can only see/modify data for homes they belong to.

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

> **Similar policies needed for:** homes, user_homes, categories, item_categories, shopping_list_items, notifications. All follow the `is_home_member()` pattern.

---

## 5. PowerSync Sync Rules

PowerSync needs to know what data to sync to each user's device. Sync rules define the subset of Postgres data each client receives.

```yaml
# PowerSync Sync Rules (conceptual — actual syntax may vary)
#
# Each user syncs data for all homes they belong to.
# This means a user's local SQLite has:
#   - All homes they're a member of
#   - All items in those homes
#   - All transactions for those items
#   - All categories for those homes
#   - Shopping list items for those homes

bucket_definitions:
  - name: user_homes
    parameters: SELECT home_id FROM user_homes WHERE user_id = token_parameters.user_id
    data:
      - SELECT * FROM homes WHERE id = bucket.home_id
      - SELECT * FROM items WHERE home_id = bucket.home_id
      - SELECT * FROM categories WHERE home_id = bucket.home_id
      - SELECT * FROM item_categories WHERE item_id IN (SELECT id FROM items WHERE home_id = bucket.home_id)
      - SELECT * FROM inventory_transactions WHERE item_id IN (SELECT id FROM items WHERE home_id = bucket.home_id)
      - SELECT * FROM shopping_list_items WHERE home_id = bucket.home_id
```

> **Note:** As the transaction ledger grows, consider syncing only recent transactions (e.g., last 90 days) to keep the local DB lean. The `current_inventory` cached value provides the current count without needing the full history.

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
2. Look up device tokens from `device_tokens` table
3. Call Firebase Cloud Messaging (FCM) HTTP v1 API:
   POST https://fcm.googleapis.com/v1/projects/{project}/messages:send
   Body: { message: { token: "...", notification: { title: "Running low!", body: "Paper Towels is running low" } } }
4. FCM handles delivery to iOS (via APNs) and Android natively
```

> **Firebase scope:** FCM is the ONLY Firebase service used. No Firestore, no Firebase Auth, no Firebase Analytics. Supabase Edge Functions call the FCM HTTP API directly — the Firebase SDK is not needed in the client app. Device tokens are registered via `@capacitor/push-notifications` and stored in Supabase.

### Shopping List Generation

```
POST /functions/v1/generate-shopping-list
Body: { home_id: "..." }

1. Query items WHERE current_inventory <= warning_amount AND NOT is_archived
2. Create shopping_list_items for each
3. Return the list
```

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
- Transaction history (ledger entries)
- Edit item metadata
- Archive/delete

### 4. Add Item

- Barcode scanner (Capacitor camera plugin → Open Food Facts lookup)
- Manual entry fallback
- Category assignment
- Set initial quantity and warning threshold

### 5. Shopping List

- Generated from low/out-of-stock items, or manually added
- Checkable items (checked items move to bottom / fade)
- Synced across household members in real-time
- Checking an item optionally creates an inventory transaction ("purchased")

### 6. Settings / Home Management

- Home name, invite members (via link or email)
- Member list with roles
- Account settings, notifications preferences
- (Future) manage multiple homes, subscription

---

## 8. Monetization

### Philosophy

The free tier is a complete, good product. Nobody feels punished. Paid tier adds value at scale.

### Free Tier

- 1 home
- Up to 3-4 household members
- Unlimited items (soft cap ~500 per home for abuse prevention)
- Full inventory tracking, ledger, shopping lists
- Push notifications for low stock
- Barcode scanning + Open Food Facts auto-fill
- Offline sync via PowerSync

### Paid Tier (~$2-4/mo or $20-30/yr)

- Additional homes (vacation house, office, etc.)
- Larger household size (5+ members)
- Bulk import (CSV/spreadsheet)
- Analytics & trends ("you use 4 rolls of paper towels/month")
- Predictive restocking ("you'll probably need coffee in 5 days")

### v1 Approach

Don't build payment infrastructure yet. Ship the free app, get real usage data, validate the paid features with actual user behavior. Supabase free tier covers early usage. Add Stripe when you have users hitting limits.

---

## 9. Product Image Strategy

### Layer 1: Barcode Scan → Auto-fill (primary)

- User scans barcode via Capacitor camera plugin
- Edge Function queries Open Food Facts / Open Products Facts API
- Returns product name, image URL, category suggestion
- Pre-fills the Add Item form — satisfying UX, no UGC

### Layer 2: Category Icons (fallback)

- Items without a barcode match get a category-based icon
- Small curated set: cleaning, food, bathroom, kitchen, etc.

### Layer 3: User Photo Upload (optional)

- User can snap a photo → stored in Supabase Storage
- Only visible to household members (not public-facing)
- UGC moderation risk is negligible in a household context
- Revisit moderation if images ever become cross-household visible

---

## 10. Deployment Strategy

### Single Codebase, Two Targets

```
supply-stash/
├── apps/
│   └── supply-stash/              # Nuxt app
│       ├── assets/                # Tailwind CSS, custom brand tokens
│       ├── components/            # Vue components (using Konsta UI primitives)
│       ├── composables/           # PowerSync hooks, barcode scanner, etc.
│       ├── layouts/               # App shell layout (tab bar, nav)
│       ├── pages/                 # File-based routing
│       ├── plugins/               # PowerSync plugin, Supabase client
│       ├── server/                # Nuxt API routes (escape hatch)
│       ├── ios/                   # Capacitor iOS project (generated)
│       ├── android/               # Capacitor Android project (generated)
│       ├── capacitor.config.ts
│       └── nuxt.config.ts
├── packages/
│   └── types/                     # Shared TypeScript types, PowerSync schema
├── supabase/
│   ├── migrations/                # SQL migrations (ledger-first schema)
│   ├── functions/                 # Edge Functions (barcode lookup, push triggers)
│   └── config.toml
└── pnpm-workspace.yaml
```

### Web Deployment

```bash
nuxt generate        # or: vite build
# Deploy .output/public (or dist/) to Vercel/Netlify/Cloudflare Pages
```

### Mobile Deployment

```bash
nuxt generate        # same build
npx cap sync         # copies web build into native projects
npx cap open ios     # opens in Xcode → build → App Store
npx cap open android # opens in Android Studio → build → Play Store
```

### Platform-Specific Code Pattern

```typescript
import { Capacitor } from "@capacitor/core";

// Feature detection, not platform branching
export function useBarcodeScanner() {
  if (Capacitor.isNativePlatform()) {
    // Use native camera-based barcode scanner plugin
    return useNativeBarcodeScanner();
  } else {
    // Use web-based scanner (getUserMedia) or hide feature
    return useWebBarcodeScanner();
  }
}
```

---

## 11. Decisions Log

| Decision           | Choice                                                                                                   | Rationale                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Nuxt                                                                                                     | File-based routing, SSR/SSG for marketing, API route escape hatch, module ecosystem                                           |
| UI Components      | Konsta UI v5 + Tailwind                                                                                  | Mobile-native primitives (iOS/Material adaptive) without owning routing/app shell; Tailwind-native so custom branding is easy |
| Mobile Runtime     | Capacitor                                                                                                | Single codebase deploys to web + App Store; native plugin access for camera, push, haptics                                    |
| Backend            | Supabase all-in (no custom server)                                                                       | RLS for auth, Edge Functions for server logic, Storage for photos, Realtime for presence                                      |
| Sync Engine        | PowerSync                                                                                                | Only sync engine with first-class offline + dedicated Capacitor SDK with native SQLite; Vue composables available             |
| Push Notifications | Firebase Cloud Messaging (only)                                                                          | FCM is the standard; called from Supabase Edge Functions; no other Firebase services used                                     |
| Data Model         | Ledger-first (append-only transactions)                                                                  | Conflict-free offline writes; existing `inventory_transactions` table is already this pattern                                 |
| Product Images     | Open Food Facts API (ODbL license — attribute, share-alike for derivative DBs; safe for API consumption) | Free, 4M+ products, barcode lookup with images; fallback to category icons + user photo upload                                |
| Monetization       | Free tier complete; paid for scale                                                                       | 1 home + 3-4 members free; paid adds homes, members, bulk import, analytics                                                   |
| Analytics          | Skip for v1                                                                                              | Add PostHog, Plausible, or Firebase Analytics later based on actual need                                                      |
| Crash Reporting    | Skip for v1                                                                                              | Add Sentry or Crashlytics later                                                                                               |

---

## 12. Open Questions / Future Decisions

- **PowerSync Capacitor SDK maturity:** Currently alpha. Monitor for stability. Fallback: plain Supabase Realtime for sync (loses offline, but works).
- **PowerSync Cloud vs self-hosted:** Start with Cloud free tier. Self-host if costs or privacy become concerns.
- **Transaction ledger pruning:** Over time, old transactions accumulate. Consider archiving transactions older than N months while preserving the cached count. Not a v1 concern.
- **Shopping list → inventory loop:** When a user checks off a shopping list item, auto-create an inventory transaction? Needs UX thought (what quantity? confirm or assume?).
- **Barcode scanner library:** Evaluate Capacitor plugins for barcode scanning (e.g., `@capacitor-mlkit/barcode-scanning` or `@capawesome/capacitor-barcode-scanner`).
- **Konsta UI customization depth:** Decide early how much to override Konsta's default iOS/Material themes vs. building a fully custom design system. Recommend starting with Konsta defaults + custom color palette, then evolving.
- **ElectricSQL as alternative:** If PowerSync's Capacitor SDK proves too unstable, ElectricSQL with PGlite is the backup sync engine to evaluate. Lacks Capacitor-specific SDK but has strong Postgres integration.
- **Web version timing:** Web deploy is free (same codebase), but decide when to invest in web-specific UX (marketing site, desktop dashboard). Not a v1 priority.
