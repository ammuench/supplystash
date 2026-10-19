import { QueryClient } from "@tanstack/react-query";

import { queryPersister } from "@/lib/query-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Everything is immediately stale, so refetch-on-mount/focus/reconnect all
      // fire. Focus-refetch is the self-heal for a dropped Realtime socket, and
      // stale-while-revalidate keeps those refetches from showing a spinner.
      staleTime: 0,
      // Must be >= the persister's maxAge (Infinity), or queries are collected
      // in memory and never reach disk. See docs/persistence.md.
      gcTime: Infinity,
      retry: 2,
      // Native only; undefined on web. Only allowlisted roots reach disk.
      persister: queryPersister?.persisterFn,
    },
    mutations: {
      // Membership and home management are online-only, so a failed mutation is
      // a real failure the UI must surface rather than silently retry. A
      // mutation that may be queued offline opts in to retries through
      // `queryClient.setMutationDefaults` under its own `mutationKey`. The
      // defaults carry its `mutationFn` (a function can't be persisted), so
      // they must be registered at module scope, in a module app/_layout.tsx
      // imports, so they exist before QueryProvider restores the paused
      // queue. See docs/persistence.md.
      retry: 0,
    },
  },
});
