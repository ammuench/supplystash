import type { QueryCache } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { isPersistedQuery } from "@/lib/query-persister-config";

// A number, not the query list, so useSyncExternalStore sees a stable snapshot
// and only re-renders when the answer changes.
const oldestPersistedUpdatedAt = (cache: QueryCache): number | null => {
  let oldest: number | null = null;
  for (const query of cache.findAll({ predicate: isPersistedQuery })) {
    const { dataUpdatedAt } = query.state;
    // 0 means the query has never had data, so it says nothing about age.
    if (dataUpdatedAt > 0 && (oldest === null || dataUpdatedAt < oldest)) {
      oldest = dataUpdatedAt;
    }
  }
  return oldest;
};

/** The oldest `dataUpdatedAt` across the persisted query roots, or null when
 * none has data. This is how old the oldest thing on screen can be, which is
 * what the offline banner's age suffix reports. See docs/connectivity.md.
 */
export const useOldestPersistedUpdatedAt = () => {
  const cache = useQueryClient().getQueryCache();
  const getSnapshot = useCallback(() => oldestPersistedUpdatedAt(cache), [cache]);

  return useSyncExternalStore(cache.subscribe, getSnapshot);
};
