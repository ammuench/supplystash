import { experimental_createQueryPersister } from "@tanstack/query-persist-client-core";

import { queryCacheStorage } from "@/lib/query-cache-storage";
import { gateQueryCacheWrites } from "@/lib/query-cache-write-gate";
import { isPersistedQuery, QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";

// Native read-cache persister. Metro resolves this file on iOS/Android and
// lib/query-persister.ts on web. Each allowlisted query is its own kv-store
// row, so write cost stays flat as the number of homes grows.
export const queryPersister = experimental_createQueryPersister({
  // Gated so a save scheduled before a sign-out wipe cannot land after it.
  storage: gateQueryCacheWrites(queryCacheStorage),
  buster: QUERY_CACHE_BUSTER,
  // Offline data is only useful if it is still there after a long trip.
  // Staleness is surfaced in the UI instead (STASH-40).
  maxAge: Infinity,
  filters: { predicate: isPersistedQuery },
});
