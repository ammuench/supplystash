import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile networks are slow and flaky; a short stale window keeps screens
      // from refetching every time a tab regains focus.
      staleTime: 30_000,
      retry: 2,
    },
    mutations: {
      // Membership and home management are online-only, so a failed mutation is
      // a real failure the UI must surface rather than silently retry.
      retry: 0,
    },
  },
});
