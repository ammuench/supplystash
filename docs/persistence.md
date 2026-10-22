# Persistence

There are **two independent persistence layers**. They are easy to conflate; keep them separate.

| Layer            | Stores                                                            | Backend                                                                                                                                                                   | Status                                                                                                                |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Auth session** | Supabase JWT + refresh token                                      | `LargeSecureStore` — AES-256 key in `expo-secure-store`, ciphertext in `@react-native-async-storage/async-storage`. Web: none (supabase-js falls back to `localStorage`). | **Done.** `apps/supplystash/lib/supabase.ts`. Near-verbatim from Supabase's Expo guide; deliberately not "optimized". |
| **Query cache**  | Dehydrated TanStack Query cache + paused (offline) mutation queue | `expo-sqlite/kv-store` on native. Web: none — memory-only, refresh means refetch.                                                                                         | **Read cache wired** (STASH-35). **Paused-mutation queue wired** (STASH-36). **Boot restore gate** (STASH-37).        |

## Auth session (Project 1 — settled)

`expo-secure-store` caps values at 2048 bytes and a Supabase session (JWT) exceeds that. So
`LargeSecureStore` keeps a random AES-256 key in SecureStore and the encrypted session in
AsyncStorage. Native sessions are encrypted at rest; web sessions sit in `localStorage` as
plaintext (standard web tradeoff, not an oversight). **Nothing about this layer is open.**

`expo-sqlite` plays **no part** here — it exists in the tree only for the query-cache layer below.

## Query cache (Project 4 — read cache + paused-mutation queue wired)

Backed by `expo-sqlite/kv-store`. Why, from architecture §5.4:

- Needs a **synchronous** read API so the splash screen can hold until `useIsRestoring()`
  settles without a flash of empty-then-populated content.
- `react-native-mmkv` and `expo-sqlite/kv-store` are equivalent on performance for this access
  pattern (a ~100KB blob, throttled, off the hot path). Tiebreaker is dependency risk:
  `expo-sqlite` is in Expo's own module set and upgrades on the SDK cadence we already take.
- Bare `AsyncStorage` is rejected: async-only (breaks the sync cold-start gate) and
  SQLite-backed on Android anyway.
- Native module → requires a **dev build**, not Expo Go. This is why the package is installed
  now rather than in Project 4.
- **Web has no query-cache persistence at all.** Consequence: the shopping-list check-off is
  online-only on web (a paused mutation would live in memory and vanish on refresh).

Two persisters, split by concern (architecture §5.4): a per-query persister
(`experimental_createQueryPersister`) for the read cache so write cost is flat in home count,
and `persistQueryClient` with `shouldDehydrateQuery: () => false` for the small paused-mutation
blob (STASH-36). Both live in the `query-cache` database.

### Read cache (built)

| File                                                                                 | Role                                                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [`lib/query-cache-storage.ts`](../apps/supplystash/lib/query-cache-storage.ts)       | kv-store adapter, including the `entries()` that `restoreQueries` and `persisterGc` need. Own `query-cache` database. |
| [`lib/query-persister-config.ts`](../apps/supplystash/lib/query-persister-config.ts) | `PERSISTED_QUERY_ROOTS` allowlist, `SCHEMA_VERSION`, `QUERY_CACHE_BUSTER`. Platform-free.                             |
| [`lib/query-persister.native.ts`](../apps/supplystash/lib/query-persister.native.ts) | The persister. `maxAge: Infinity`, `filters` = the allowlist.                                                         |
| [`lib/query-persister.ts`](../apps/supplystash/lib/query-persister.ts)               | Web stub: `undefined`. Metro picks it on web, which keeps expo-sqlite out of the web bundle.                          |
| [`lib/query-cache-restore.ts`](../apps/supplystash/lib/query-cache-restore.ts)       | Boot `restoreQueries()` pass, started on import, and `useIsQueryCacheRestored()` for the splash and render gate.      |

`lib/query-client.ts` sets `defaultOptions.queries.persister` to `queryPersister?.persisterFn`.

- **Allowlist:** `items`, `categories`, `shoppingList`, `homes` — see
  [query-keys.md](./query-keys.md) rule 6.
- **Buster** = `` `${SCHEMA_VERSION}:${PERSISTED_QUERY_ROOTS.join(",")}` ``. Bump
  `SCHEMA_VERSION` when a persisted row's shape changes. Changing the allowlist busts the cache
  on its own: with `maxAge: Infinity` nothing expires, so the buster is the only thing that
  marks a removed root's rows as stale. Adding a root costs one refetch of everything.
- **The boot pass restores the allowlist before the first screen.** Lazy restore alone (each
  query reads its row when it first runs) would paint an empty first screen for a frame.
  `lib/query-cache-restore.ts` runs `restoreQueries()` at boot, once per allowlisted root:
  it ignores the persister's `filters` and takes a single `queryKey`, not a predicate.
  `SplashScreenController` holds the splash and `RootNavigator` renders nothing until it
  settles. The render gate is not only cosmetic: `restoreQueries` writes with `setQueryData`,
  which would overwrite data a screen fetched while the pass was still running.
- **Busted rows are deleted by the boot pass.** Lazy restore never reads a non-allowlisted row,
  so it never deletes a removed root's rows. `restoreQueries` reads every row and deletes
  unreadable and busted ones before applying its `queryKey` filter, so the first call cleans
  every root.
- **A failed boot pass never holds the splash.** It sends `query_cache_restore_failed` and
  resolves. Nothing is cleared: rows restored before the failure already passed the buster
  check, and lazy restore still serves the rest.
- **Sign-out does not wipe disk yet.** `queryClient.clear()` only empties memory. STASH-38
  clears the `query-cache` database.
- **Writes follow `queryFn` only.** A query is saved after it fetches, so `setQueryData`
  (optimistic updates) reaches disk only on the next refetch.

### Paused-mutation queue (built)

| File                                                                                               | Role                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`lib/mutation-persister.ts`](../apps/supplystash/lib/mutation-persister.ts)                       | Hand-rolled `Persister` over the kv-store adapter. One blob under `PAUSED_MUTATIONS_KEY`. Skips unchanged writes, reports failures. |
| [`components/query-provider.native.tsx`](../apps/supplystash/components/query-provider.native.tsx) | `PersistQueryClientProvider`: mutations only, `maxAge: Infinity`, the read cache's buster. Replays the queue once restore finishes. |
| [`components/query-provider.tsx`](../apps/supplystash/components/query-provider.tsx)               | Web: plain `QueryClientProvider`. Nothing is persisted.                                                                             |
| [`lib/postgrest-error.ts`](../apps/supplystash/lib/postgrest-error.ts)                             | `postgrestErrorCode(error)` for rejection handling.                                                                                 |

- **Same database, different key.** The blob sits in `query-cache` under `paused-mutations`, so
  STASH-38's wipe clears both persisters at once. The key must never start with
  `tanstack-query-`: `restoreQueries` and `persisterGc` treat every key with that prefix as a
  query row.
- **Shared buster.** Bumping `SCHEMA_VERSION` or changing the allowlist also drops any queued
  check-offs on the next launch. Deliberate: a queued write against a reshaped row is not safe
  to replay.
- **Writes skip unchanged blobs, not throttled ones.** `persistQueryClient` saves on every
  query and mutation event. Queries never enter this blob, so most saves are identical and are
  skipped by comparing `buster` + `clientState` (`timestamp` is ignored). A changed blob is
  written immediately, so a force-quit right after a check-off cannot lose it. No
  `query-async-storage-persister`: its throttle opens exactly that loss window.
- **Failures are reported, not thrown.** TanStack fires saves without awaiting them, so a failed
  write is caught and sent as `paused_mutation_persist_failed`; the next cache event retries it.
  A failed restore sends `paused_mutation_restore_failed` and rethrows, so TanStack discards the
  unreadable blob.
- **Replay does not hold the restore.** `onSuccess` starts `resumePausedMutations()` without
  returning it. Offline, the replay does not settle until the network is back, and the provider
  holds `useIsRestoring()` true until `onSuccess` settles, which would block every query from
  reading the cache. The provider only starts saving on the commit after restore, so `onSuccess`
  also saves on every mutation event until the replays settle, then once more. Otherwise a
  replay that settles in that gap leaves its stale entry on disk to replay again.
- **Replays are at-most-once.** Only _paused_ mutations are saved. A resumed replay stops being
  paused as soon as its request starts, so its entry leaves disk while the request is in
  flight. A force-quit in that window loses the write if the server never received it. The
  alternative (keep in-flight replays on disk, restore them as paused) is at-least-once and
  would replay a write the server already applied, so it waits until every offline mutation is
  idempotent. Tracked in STASH-44.
- **`useIsRestoring()` is true while this blob restores.** It does not cover the read cache;
  `useIsQueryCacheRestored()` does. The splash waits on both.
- **Replay needs connectivity wiring.** On RN, `onlineManager` never goes offline until STASH-39
  backs it with NetInfo, so nothing pauses in the app yet. The round trip is covered by
  `components/__tests__/query-provider.test.tsx` instead.

#### Writing an offline-capable mutation

A persisted mutation is saved without its functions, so it can only be replayed through
defaults registered under its key.

1. Give it a `mutationKey`.
2. Register its `mutationFn` (and `onError`, retry) with `queryClient.setMutationDefaults` at
   **module scope**, in a module `app/_layout.tsx` imports. Defaults registered later are missing
   when `QueryProvider` restores, and the restored mutation has nothing to run.
3. In the `mutationFn`, call supabase-js with `.throwOnError()`. It throws the `PostgrestError`
   itself, so `.code` reaches `onError`. Wrapping `error.message` in a new `Error` loses it.
4. In `onError`, branch on `postgrestErrorCode(error)` (`42501` = RLS denied, `PGRST116` = no
   row), never on message text.
5. Make it **idempotent**: running it twice must leave the same rows as running it once. Inserts
   take a client-generated id (a replay then hits the primary key instead of adding a second
   row); updates set absolute values (`checked: true`), never relative ones (`quantity + 1`).
   Today replays are at-most-once, so this is not yet load-bearing, but STASH-44's switch to
   at-least-once depends on it.

The global default stays `mutations.retry: 0`. Retry policy for offline mutations is Project 7's.
