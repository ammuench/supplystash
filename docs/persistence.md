# Persistence

There are **three independent persistence layers**. They are easy to conflate; keep them separate.

| Layer            | Stores                                                            | Backend                                                                                                                                                                   | Status                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth session** | Supabase JWT + refresh token                                      | `LargeSecureStore` — AES-256 key in `expo-secure-store`, ciphertext in `@react-native-async-storage/async-storage`. Web: none (supabase-js falls back to `localStorage`). | **Done.** `apps/supplystash/lib/supabase.ts`. Near-verbatim from Supabase's Expo guide; deliberately not "optimized".                                                    |
| **Query cache**  | Dehydrated TanStack Query cache + paused (offline) mutation queue | `expo-sqlite/kv-store` on native. Web: none — memory-only, refresh means refetch.                                                                                         | **Read cache wired** (STASH-35). **Paused-mutation queue wired** (STASH-36). **Boot restore gate** (STASH-37). **Sign-out wipe** (STASH-38). **Owner check** (STASH-64). |
| **Active home**  | The id of the home the user last opened, and who opened it        | `@react-native-async-storage/async-storage`. Web: `localStorage`, through the same package.                                                                               | **Done** (STASH-59). `apps/supplystash/state/active-home.store.ts`.                                                                                                      |

## Auth session (Project 1 — settled)

`expo-secure-store` caps values at 2048 bytes and a Supabase session (JWT) exceeds that. So
`LargeSecureStore` keeps a random AES-256 key in SecureStore and the encrypted session in
AsyncStorage. Native sessions are encrypted at rest; web sessions sit in `localStorage` as
plaintext (standard web tradeoff, not an oversight). **Nothing about this layer is open.**

`expo-sqlite` plays **no part** here — it exists in the tree only for the query-cache layer below.

## Query cache (Project 4 — read cache, paused-mutation queue and sign-out wipe wired)

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
| [`lib/query-cache-wipe.ts`](../apps/supplystash/lib/query-cache-wipe.ts)             | Sign-out's disk wipe: every read-cache row plus the paused-mutation blob. See [Sign-out](#sign-out-built).            |

`lib/query-client.ts` sets `defaultOptions.queries.persister` to `queryPersister.persisterFn`,
wrapped in `skipPersistAfterWipe` (see [Sign-out](#sign-out-built)).

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
- **Sign-out wipes disk.** See [Sign-out](#sign-out-built).
- **Writes follow `queryFn` only.** A query is saved after it fetches, so `setQueryData`
  (optimistic updates) reaches disk only on the next refetch.

### Paused-mutation queue (built)

| File                                                                                                     | Role                                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`lib/mutation-persister.ts`](../apps/supplystash/lib/mutation-persister.ts)                             | Hand-rolled `Persister` over the kv-store adapter. One blob under `PAUSED_MUTATIONS_KEY`. Skips unchanged writes, reports failures. |
| [`lib/paused-mutation-persister.native.ts`](../apps/supplystash/lib/paused-mutation-persister.native.ts) | The one instance, shared by the provider and the sign-out wipe. Web stub: `lib/paused-mutation-persister.ts` (`undefined`).         |
| [`components/query-provider.native.tsx`](../apps/supplystash/components/query-provider.native.tsx)       | `PersistQueryClientProvider`: mutations only, `maxAge: Infinity`, the read cache's buster. Replays the queue once restore finishes. |
| [`components/query-provider.tsx`](../apps/supplystash/components/query-provider.tsx)                     | Web: plain `QueryClientProvider`. Nothing is persisted.                                                                             |
| [`lib/postgrest-error.ts`](../apps/supplystash/lib/postgrest-error.ts)                                   | `postgrestErrorCode(error)` for rejection handling.                                                                                 |

- **Same database, different key.** The blob sits in `query-cache` under `paused-mutations`, next
  to the read cache. So does the owner check's `query-cache-owner` key (see
  [Sign-out](#sign-out-built)). Neither may ever start with `tanstack-query-`: `restoreQueries`
  and `persisterGc` treat every key with that prefix as a query row.
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
- **Pause and replay follow the device's network.** `expo-network` backs `onlineManager` on
  native (STASH-39), so a write made offline pauses and replays on reconnect. The replay after a
  restore waits for the first real network reading (`whenOnlineStateKnown()`). See
  [connectivity.md](./connectivity.md). The persist-and-restore round trip is covered by
  `components/__tests__/query-provider.test.tsx`.

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

### Sign-out (built)

`queryClient.clear()` only empties memory, and RLS does nothing to the client cache. Without a disk
wipe the next account's boot pass restores the previous one's rows, and `["homes"]` is not
user-scoped, so it would show them the old account's homes.

| File                                                                                             | Role                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`state/session.tsx`](../apps/supplystash/state/session.tsx)                                     | `SIGNED_OUT` handler: counts paused mutations, clears memory, starts the wipe, clears again after the boot pass, toasts.                              |
| [`lib/query-cache-wipe.ts`](../apps/supplystash/lib/query-cache-wipe.ts)                         | `removeQueries()` (no filters) on the read persister + `removeClient()` on the shared mutation persister. Never rejects. Also `skipPersistAfterWipe`. |
| [`lib/query-cache-write-gate.ts`](../apps/supplystash/lib/query-cache-write-gate.ts)             | Read-cache storage wrapper: runs calls one at a time, drops writes from the wipe until the next `SIGNED_IN`.                                          |
| [`lib/query-cache-owner.native.ts`](../apps/supplystash/lib/query-cache-owner.native.ts)         | Owner check: `claimQueryCache` compares the stored owner with the signed-in user and wipes on a mismatch. Web stub: `lib/query-cache-owner.ts`.       |
| [`hooks/use-is-query-cache-claimed.ts`](../apps/supplystash/hooks/use-is-query-cache-claimed.ts) | `useIsQueryCacheClaimed(userId)`: starts the claim when the user changes; `RootNavigator` and the splash wait on it.                                  |
| [`hooks/use-sign-out.ts`](../apps/supplystash/hooks/use-sign-out.ts)                             | The deliberate flow: count queued changes, ask, sign out, toast. Ref-guarded against double presses.                                                  |
| [`components/sign-out-button.tsx`](../apps/supplystash/components/sign-out-button.tsx)           | Button + confirm dialog on that hook. Any screen that offers sign-out renders this, so the flow is not tied to one screen.                            |

- **One handler for every sign-out.** Supabase emits `SIGNED_OUT` for the button, a remote
  sign-out and a rejected refresh token alike, so all teardown lives in `state/session.tsx`, not
  in the button.
- **The wipe starts at the first clear, not after the boot pass.** The pass reads every row up front
  and never writes to disk, so deleting rows mid-pass changes nothing it does. Memory is the part
  the pass can undo, which is why `queryClient.clear()` runs again once `queryCacheRestored`
  settles. Mid-session that second clear finds nothing.
- **The blob goes through `removeClient`, never a raw `clearAsync()`.** `removeClient` waits in the
  persister's write queue, so a save still in flight cannot land after the delete and put the old
  account's queue back.
- **A restore that overlaps the wipe drops what it read.** A refresh token rejected at launch can
  sign out while `PersistQueryClientProvider` is still reading the blob. Every `removeClient` call
  bumps a counter; `restoreClient` returns `undefined` if it changed during the read, so nothing
  is hydrated, replayed or saved back. The dropped count goes to
  `paused_mutations_dropped_on_sign_out`.
- **Queued changes are discarded, never carried over.** Replaying them under the next account would
  be an RLS denial at best and a write to a shared home as the wrong user at worst.
  - Deliberate sign-out: `<SignOutButton />` asks first ("N changes haven't synced yet…") when
    `countPausedMutations` is above zero.
  - Involuntary sign-out: it cannot ask, so the expiry toast names the count
    (`sessionExpiredMessage`). Mutations dropped mid-restore never reach memory, so only analytics
    sees those.
- **A failed wipe is reported, not thrown:** `query_cache_wipe_failed`. Each half runs regardless
  of the other.
- **A fetch in flight at sign-out cannot write its row back.** `clear()` cancels each query, but
  cancelling only stops TanStack from using the result: `persisterFn` is still awaiting `queryFn`,
  and saves `query.state` (the old account's last data) once the response lands. With
  `staleTime: 0` a refetch is often in flight, and the network is far slower than the SQLite
  delete, so without a guard that write usually lands after the wipe. `skipPersistAfterWipe`
  notes a wipe counter when a fetch starts and throws `FetchOutlivedWipeError` from the wrapped
  `queryFn` if a wipe happened since, which stops `persisterFn` before the save. The query was
  already cancelled, so nothing sees the error.
- **A save scheduled before sign-out cannot land after the wipe.** TanStack saves a row on a
  later tick than the response, so a response that landed just before sign-out passes the check
  above and its save runs after the wipe has listed the rows. The read persister's storage goes
  through `gateQueryCacheWrites`: the wipe closes it and `SIGNED_IN` opens it, and while it is
  closed every write is dropped (no query runs while signed out). Every storage call also runs one
  at a time, so a save already started finishes before `removeQueries` lists the rows. The
  counter above still matters for a fetch that outlives the next sign-in, when the gate is open
  again.
- **The wipe can still fail or be cut short, so a sign-in checks who owns the cache (STASH-64).**
  The sign-out wipe is not awaited or retried: the app killed mid-wipe, or a failed delete,
  leaves rows on disk for the next launch's boot pass to restore. So the cache records its owner:
  - `query-cache-owner` holds the user id the cached rows belong to, in the `query-cache` database.
  - `RootNavigator` renders no screen for a signed-in user until `useIsQueryCacheClaimed` is true
    for that user, and the splash waits on it at cold start. On a sign-in mid-session this is a
    blank frame lasting one SQLite read, or a wipe when the account changed.
  - The claim waits for the boot pass, then reads the owner. A match keeps everything. A mismatch,
    a missing owner or an unreadable one clears memory and wipes disk. Only if the wipe succeeded
    does it reopen the write gate and record the new owner. After a failed wipe both stay as they
    were: this user's rows are kept in memory only, never saved under the old owner (whose next
    launch would match and restore them), and the next claim wipes again. Failures are reported
    as `query_cache_claim_failed` and never hold the screens.
  - A missing owner wipes rather than adopting the rows: installs from before STASH-64 cannot say
    whose rows they hold, so they refetch once.
  - Claims run one at a time, so one that wipes finishes before the next reads the owner. Only
    the latest request marks the cache claimed: after A → B → A mid-claim, the first A claim
    finishing does not open the screens while the queued claims, which clear the cache, still
    have to run. The
    gate is on rendering, not on `SessionProvider`, so a sign-out mid-claim needs no ordering: the
    session goes null and the claim's result is dropped.
- **Known gaps.**
  - Lazy restore could read a row if the next account signs in before the wipe finishes. The wipe
    is local SQLite and sign-in is a network round trip, so this is accepted.
  - A wipe that fails during a claim leaves the old rows on disk while the new user carries on,
    since sign-in cannot be blocked on it. Memory was cleared, but lazy restore reads a query's row
    the first time it runs, so those screens can show the old account's data for that session.
    Nothing is saved for the new user meanwhile. The next claim, at the next sign-in or launch,
    wipes again. STASH-64 only asks for that; holding
    the screens until a wipe succeeds would trade it for a user stuck on a blank screen.
  - Paused mutations restored at boot can start replaying before the claim clears them. Replay
    waits for the first network reading, so the claim usually wins, but nothing enforces it.

## Active home (STASH-59)

One small value: `{ owner, homeId }`, saved by `useActiveHomeStore` in
[`state/active-home.store.ts`](../apps/supplystash/state/active-home.store.ts). Screens read it
through `useActiveHome()` in [`state/active-home.ts`](../apps/supplystash/state/active-home.ts).

- **Set when a home is opened:** `homes/[homeId].tsx`, once `useHome` confirms the user is a member.
- **Resolved at read time.** The stored id counts only when `owner` is the signed-in user and the id
  is in the homes list. A stale or foreign id is ignored, not cleared, so the hook only reads.
  With no valid id and exactly one home, that home is active, but it is not saved.
- **Cleared on sign-out** in the `SIGNED_OUT` handler in `state/session.tsx`. The owner check
  covers a clear that never ran (the app was killed, say).
- **AsyncStorage, not the `query-cache` database.** The restore pass treats every key there as a
  query row. An unreadable value counts as no active home, so the hook never stays loading.
- **The splash does not wait for it.** `useActiveHome()` reports `isLoading` instead; the Home tab
  never needs the value.
