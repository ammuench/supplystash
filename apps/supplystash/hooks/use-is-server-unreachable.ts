import type { Query, QueryCache } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { isNetworkFailure } from "@/lib/postgrest-error";
import { isPersistedQuery } from "@/lib/query-persister-config";

/** A persisted query whose last fetch failed without a real server answer.
 * With saved data, `status` stays "error" until a later fetch succeeds, so a
 * refetch in flight still counts. Without data, a refetch resets it to
 * "pending" and it stops counting until that fetch fails too; the screen shows
 * its own loading state meanwhile.
 */
export const isUnreachableQuery = (query: Query) =>
  isPersistedQuery(query) && query.state.status === "error" && isNetworkFailure(query.state.error);

const hasUnreachableQuery = (cache: QueryCache) =>
  cache.findAll({ predicate: isUnreachableQuery }).length > 0;

/** Whether a persisted query cannot reach the server. No failure counter is
 * needed: with the default `retry: 2`, a query only reaches "error" after 3
 * failed attempts in a row. Ignores connectivity on purpose; the bar gives way
 * to the offline banner. See docs/connectivity.md.
 */
export const useIsServerUnreachable = () => {
  const cache = useQueryClient().getQueryCache();
  const readUnreachable = useCallback(() => hasUnreachableQuery(cache), [cache]);

  return useSyncExternalStore(cache.subscribe, readUnreachable);
};
