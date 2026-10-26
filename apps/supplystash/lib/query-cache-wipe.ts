import type {
  experimental_createQueryPersister,
  Persister,
} from "@tanstack/query-persist-client-core";

import { capture } from "@/lib/analytics";
import { pausedMutationPersister } from "@/lib/paused-mutation-persister";
import { closeQueryCacheWrites } from "@/lib/query-cache-write-gate";
import { queryPersister } from "@/lib/query-persister";

type QueryPersister = ReturnType<typeof experimental_createQueryPersister>;

// Bumped by every wipe, on the call rather than when it finishes, so a fetch
// that started before the wipe sees it as soon as it returns.
let wipes = 0;

// Sign-out's disk half. `queryClient.clear()` only empties memory, so without
// this the next account's boot pass restores the previous one's rows, and
// `["homes"]` is not user-scoped. See docs/persistence.md.
//
// The blob goes through the persister's own `removeClient`, not a raw
// `clearAsync()` on the database: that is queued behind any save still in
// flight, which would otherwise land after the delete and put the old
// account's changes back to replay under the new one.
export const wipeQueryCache = async (
  readPersister: QueryPersister | undefined,
  mutationPersister: Persister | undefined,
) => {
  wipes += 1;
  // Before the delete is queued, so a save TanStack schedules from here on is
  // dropped rather than landing after it. The next sign-in opens it again.
  closeQueryCacheWrites();

  // Settled independently: one half failing must not leave the other on disk.
  const results = await Promise.allSettled([
    // No filters: every read-cache row, allowlisted or not.
    readPersister?.removeQueries(),
    mutationPersister?.removeClient(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      // Resolved, not rethrown: state/session.tsx starts this without
      // awaiting it.
      capture("query_cache_wipe_failed", {
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }
};

// Both undefined on web, where nothing is persisted.
export const wipeAppQueryCache = () => wipeQueryCache(queryPersister, pausedMutationPersister);

// Thrown in place of a result that arrived after a wipe. Nobody sees it: the
// wipe follows `queryClient.clear()`, which already cancelled the query.
export class FetchOutlivedWipeError extends Error {
  constructor() {
    super("A fetch that started before a sign-out wipe resolved after it.");
    this.name = "FetchOutlivedWipeError";
  }
}

/**
 * Wraps the read persister's `persisterFn` so a fetch in flight at sign-out
 * cannot write the old account's row back after the wipe.
 *
 * `clear()` cancels the query, but cancelling only stops TanStack from using
 * the result: `persisterFn` is still awaiting `queryFn`, and saves
 * `query.state` (the old account's last data) once the response lands. The
 * network is far slower than the SQLite delete, so that write usually lands
 * after it. Throwing from the wrapped `queryFn` stops `persisterFn` before it
 * reaches the save.
 */
export const skipPersistAfterWipe =
  (persisterFn: QueryPersister["persisterFn"]): QueryPersister["persisterFn"] =>
  (queryFn, context, query) => {
    const wipesAtStart = wipes;

    return persisterFn(
      async (queryFnContext) => {
        const data = await queryFn(queryFnContext);
        if (wipes !== wipesAtStart) {
          throw new FetchOutlivedWipeError();
        }

        return data;
      },
      context,
      query,
    );
  };
