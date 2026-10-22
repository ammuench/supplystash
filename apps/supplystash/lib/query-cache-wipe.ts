import type {
  experimental_createQueryPersister,
  Persister,
} from "@tanstack/query-persist-client-core";

import { capture } from "@/lib/analytics";
import { pausedMutationPersister } from "@/lib/paused-mutation-persister";
import { queryPersister } from "@/lib/query-persister";

// Sign-out's disk half. `queryClient.clear()` only empties memory, so without
// this the next account's boot pass restores the previous one's rows, and
// `["homes"]` is not user-scoped. See docs/persistence.md.
//
// The blob goes through the persister's own `removeClient`, not a raw
// `clearAsync()` on the database: that is queued behind any save still in
// flight, which would otherwise land after the delete and put the old
// account's check-offs back to replay under the new one.
export const wipeQueryCache = async (
  readPersister: ReturnType<typeof experimental_createQueryPersister> | undefined,
  mutationPersister: Persister | undefined,
) => {
  // Settled independently: one half failing must not leave the other on disk.
  const results = await Promise.allSettled([
    // No filters: every read-cache row, allowlisted or not.
    readPersister?.removeQueries(),
    mutationPersister?.removeClient(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      // Resolved, not rethrown: nothing awaits this but a fire-and-forget
      // `.then` in state/session.tsx.
      capture("query_cache_wipe_failed", {
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }
};

// Both undefined on web, where nothing is persisted.
export const wipeAppQueryCache = () => wipeQueryCache(queryPersister, pausedMutationPersister);
