import type { experimental_createQueryPersister } from "@tanstack/query-persist-client-core";
import type { QueryClient } from "@tanstack/react-query";

import { capture } from "@/lib/analytics";
import { queryClient } from "@/lib/query-client";
import { queryPersister } from "@/lib/query-persister";
import { PERSISTED_QUERY_ROOTS } from "@/lib/query-persister-config";

// Boot pass over the read cache. Lazy restore only reads a row when its query
// first runs, which leaves the first screen empty for a frame and never reads
// (so never deletes) a removed root's busted rows. See docs/persistence.md.
//
// `restoreQueries` takes one `queryKey`, not a predicate, so it runs once per
// allowlisted root. Every call scans all rows and deletes busted ones before
// filtering, so the first call does the cleanup for every root.
export const restoreQueryCache = async (
  client: QueryClient,
  persister: ReturnType<typeof experimental_createQueryPersister> | undefined,
) => {
  // Web has no read persister: the cache is memory-only.
  if (!persister) {
    return;
  }

  try {
    for (const root of PERSISTED_QUERY_ROOTS) {
      await persister.restoreQueries(client, { queryKey: [root] });
    }
  } catch (error) {
    // Resolved, not rethrown: the splash waits on this, and must never hang.
    // Rows restored before the failure already passed the buster check, and
    // lazy restore still serves the rest, so nothing is cleared.
    capture("query_cache_restore_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

// Started on import. app/_layout.tsx imports it, through the splash
// controller, at boot.
export const queryCacheRestored = restoreQueryCache(queryClient, queryPersister);
