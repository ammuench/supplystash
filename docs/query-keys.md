# Query-key convention

All TanStack Query keys come from the factory in
[`apps/supplystash/state/query-keys.ts`](../apps/supplystash/state/query-keys.ts). This page is
the rulebook; the factory is the enforcement.

Origin: `supply-stash-architecture.md` §5.3.

## Rules

1. **`homeId` is the second element of every home-scoped key** — `["items", homeId]`, never a
   bare `["items"]`. A bare key does not describe _whose_ data it holds: on cold start you would
   rehydrate a blob and have to compare-and-discard against the current home. Home A's rows
   rendering under home B's header is a **correctness** bug, and RLS cannot catch it (every
   cached byte is data the user is entitled to).

2. **First element** is a stable string literal naming the resource — camelCase, matching the
   hook name minus `use` (`useItems` → `"items"`).

3. **Never inline a key array in a hook or a mutation.** Import `queryKeys` and call it. The
   Realtime bridge (`state/useRealtimeBridge.ts`) invalidates with the _same_ factory call, so
   the key exists in exactly one place.

4. **Non-home-scoped keys** — today only `queryKeys.homes()` → `["homes"]`, the list of homes
   the current user belongs to. These omit `homeId` and must carry a comment in the factory
   saying why they are not home-scoped.

5. **`enabled: !!homeId`** on every home-scoped query. `homeId` is `undefined` until the active
   home resolves.

6. **Persistence allowlist (Project 4).** Only `items`, `categories`, `shoppingList`, and
   `homes` keys are persisted to disk. Everything else — history modal, barcode lookups — is
   memory-only. Adding a key to the persisted set is a deliberate change to the persister's
   `filters`, not a default.

7. **Discard a persisted cache only by bumping `buster`** (a schema-version constant on the
   persister). Never hand-invalidate a whole resource on home switch — that is the bug rule 1
   exists to prevent.

## Adding a new query key

1. Add a factory function to `state/query-keys.ts`. Home-scoped → `(homeId: string) => [...]`.
2. Add the query hook in `state/<resource>.ts` with `queryKey: queryKeys.<resource>(homeId)`
   and `enabled: !!homeId`.
3. If the underlying table emits Realtime changes, add a matching `postgres_changes` handler in
   `state/useRealtimeBridge.ts` that invalidates the same key.
4. Decide persistence: if the data must survive a cold start offline, add the table to the
   persister allowlist; otherwise leave it memory-only.
