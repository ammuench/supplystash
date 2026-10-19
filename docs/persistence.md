# Persistence

There are **two independent persistence layers**. They are easy to conflate; keep them separate.

| Layer            | Stores                                                            | Backend                                                                                                                                                                   | Status                                                                                                                |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Auth session** | Supabase JWT + refresh token                                      | `LargeSecureStore` — AES-256 key in `expo-secure-store`, ciphertext in `@react-native-async-storage/async-storage`. Web: none (supabase-js falls back to `localStorage`). | **Done.** `apps/supplystash/lib/supabase.ts`. Near-verbatim from Supabase's Expo guide; deliberately not "optimized". |
| **Query cache**  | Dehydrated TanStack Query cache + paused (offline) mutation queue | `expo-sqlite/kv-store` on native. Web: none — memory-only, refresh means refetch.                                                                                         | **Read cache wired** (STASH-35). Paused-mutation queue pending (STASH-36).                                            |

## Auth session (Project 1 — settled)

`expo-secure-store` caps values at 2048 bytes and a Supabase session (JWT) exceeds that. So
`LargeSecureStore` keeps a random AES-256 key in SecureStore and the encrypted session in
AsyncStorage. Native sessions are encrypted at rest; web sessions sit in `localStorage` as
plaintext (standard web tradeoff, not an oversight). **Nothing about this layer is open.**

`expo-sqlite` plays **no part** here — it exists in the tree only for the query-cache layer below.

## Query cache (Project 4 — read cache wired)

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
blob (STASH-36, not built yet).

### Read cache (built)

| File                                                                                 | Role                                                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [`lib/query-cache-storage.ts`](../apps/supplystash/lib/query-cache-storage.ts)       | kv-store adapter, including the `entries()` that `restoreQueries` and `persisterGc` need. Own `query-cache` database. |
| [`lib/query-persister-config.ts`](../apps/supplystash/lib/query-persister-config.ts) | `PERSISTED_QUERY_ROOTS` allowlist, `SCHEMA_VERSION`, `QUERY_CACHE_BUSTER`. Platform-free.                             |
| [`lib/query-persister.native.ts`](../apps/supplystash/lib/query-persister.native.ts) | The persister. `maxAge: Infinity`, `filters` = the allowlist.                                                         |
| [`lib/query-persister.ts`](../apps/supplystash/lib/query-persister.ts)               | Web stub: `undefined`. Metro picks it on web, which keeps expo-sqlite out of the web bundle.                          |

`lib/query-client.ts` sets `defaultOptions.queries.persister` to `queryPersister?.persisterFn`.

- **Allowlist:** `items`, `categories`, `shoppingList`, `homes` — see
  [query-keys.md](./query-keys.md) rule 6.
- **Buster** = `` `${SCHEMA_VERSION}:${PERSISTED_QUERY_ROOTS.join(",")}` ``. Bump
  `SCHEMA_VERSION` when a persisted row's shape changes. Changing the allowlist busts the cache
  on its own: with `maxAge: Infinity` nothing expires, so a removed root would otherwise sit on
  disk forever. Adding a root costs one refetch of everything.
- **Restore is lazy.** Each query reads its row when it first runs; `useIsRestoring()` does not
  see it. The cold-start splash gate is STASH-37. `restoreQueries` ignores `filters`, so that
  gate must not restore more than the allowlist.
- **Sign-out does not wipe disk yet.** `queryClient.clear()` only empties memory. STASH-38
  clears the `query-cache` database.
- **Writes follow `queryFn` only.** A query is saved after it fetches, so `setQueryData`
  (optimistic updates) reaches disk only on the next refetch.
