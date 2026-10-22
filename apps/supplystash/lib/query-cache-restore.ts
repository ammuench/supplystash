import type { experimental_createQueryPersister } from "@tanstack/query-persist-client-core";
import type { QueryClient } from "@tanstack/react-query";

import { useSyncExternalStore } from "react";

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

// A hook that is true once `promise` settles, either way: the gates on it must
// never hang. Backed by a module-level flag, not per-component state, so every
// consumer flips on the same render and one mounting after the settle reads
// true on its first render. Exported for tests.
export const createSettledHook = (promise: Promise<unknown>) => {
  let isSettled = false;
  const listeners = new Set<() => void>();
  const settle = () => {
    isSettled = true;
    listeners.forEach((listener) => listener());
  };
  void promise.then(settle, settle);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return () => useSyncExternalStore(subscribe, () => isSettled);
};

// SplashScreenController holds the splash on it and RootNavigator renders
// nothing until it is true. The render gate matters: `restoreQueries` writes
// with `setQueryData`, which would overwrite data a screen fetched while the
// pass was still running.
export const useIsQueryCacheRestored = createSettledHook(queryCacheRestored);
