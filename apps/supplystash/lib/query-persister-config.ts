import type { Query } from "@tanstack/react-query";

import type { queryKeys } from "@/state/query-keys";

// Platform-free persister settings, shared by lib/query-persister.native.ts and
// the mutation persister. See docs/persistence.md and docs/query-keys.md rules 6–7.

// Bump when the shape of persisted rows changes. Every entry saved under an
// older buster is discarded on read instead of rendering stale-shaped data.
export const SCHEMA_VERSION = 1;

// The only query roots written to disk. Everything else (item history, barcode
// lookups) is memory-only. `satisfies` ties each root to a queryKeys factory, so
// renaming one breaks the build instead of silently un-persisting it.
export const PERSISTED_QUERY_ROOTS = [
  "items",
  "categories",
  "shoppingList",
  "homes",
] as const satisfies ReadonlyArray<keyof typeof queryKeys>;

// The roots are part of the buster. With `maxAge: Infinity` nothing expires, so
// a root removed from the list would otherwise leave its entries on disk forever.
export const QUERY_CACHE_BUSTER = `${SCHEMA_VERSION}:${PERSISTED_QUERY_ROOTS.join(",")}`;

export const isPersistedQuery = (query: Query) =>
  (PERSISTED_QUERY_ROOTS as readonly unknown[]).includes(query.queryKey[0]);
