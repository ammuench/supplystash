# Persistence

There are **two independent persistence layers**. They are easy to conflate; keep them separate.

| Layer            | Stores                                                            | Backend                                                                                                                                                                   | Status                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth session** | Supabase JWT + refresh token                                      | `LargeSecureStore` — AES-256 key in `expo-secure-store`, ciphertext in `@react-native-async-storage/async-storage`. Web: none (supabase-js falls back to `localStorage`). | **Done.** `apps/supplystash/lib/supabase.ts`. Near-verbatim from Supabase's Expo guide; deliberately not "optimized".                               |
| **Query cache**  | Dehydrated TanStack Query cache + paused (offline) mutation queue | `expo-sqlite/kv-store` on native. Web: none — memory-only, refresh means refetch.                                                                                         | **Not wired.** Package is installed (so no dev-build rebuild is needed later); the persister is built in Project 4 — Offline & Realtime Foundation. |

## Auth session (Project 1 — settled)

`expo-secure-store` caps values at 2048 bytes and a Supabase session (JWT) exceeds that. So
`LargeSecureStore` keeps a random AES-256 key in SecureStore and the encrypted session in
AsyncStorage. Native sessions are encrypted at rest; web sessions sit in `localStorage` as
plaintext (standard web tradeoff, not an oversight). **Nothing about this layer is open.**

`expo-sqlite` plays **no part** here — it exists in the tree only for the query-cache layer below.

## Query cache (Project 4 — backend chosen, not built)

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
blob. Persisted resources: `items`, `categories`, `shopping_list_items`, `homes` only — see
[query-keys.md](./query-keys.md) rule 6.
