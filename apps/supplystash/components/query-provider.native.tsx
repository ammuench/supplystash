import type { QueryClient } from "@tanstack/react-query";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { createMutationPersister } from "@/lib/mutation-persister";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";

const persister = createMutationPersister(queryCacheStorage);

// Native version. Metro resolves this file on iOS/Android and
// components/query-provider.tsx on web. Persists the paused (offline) mutation
// queue so a queued write survives a force-quit, then replays it once the
// restore finishes. The read cache has its own persister on
// `defaultOptions.queries`; see docs/persistence.md.
export const QueryProvider = ({
  client,
  children,
}: {
  client: QueryClient;
  children: React.ReactNode;
}) => (
  <PersistQueryClientProvider
    client={client}
    persistOptions={{
      persister,
      // Same reasoning as the read cache: a check-off queued before a long
      // trip is still worth sending. Rows that changed shape are dropped by
      // the shared buster instead.
      maxAge: Infinity,
      buster: QUERY_CACHE_BUSTER,
      // Mutations only. `shouldDehydrateMutation` keeps its default, which
      // saves paused mutations and nothing else.
      dehydrateOptions: { shouldDehydrateQuery: () => false },
    }}
    // Restored mutations sit paused until something resumes them. They need
    // their `mutationFn` from `setMutationDefaults`, registered before this
    // mounts (see lib/query-client.ts).
    onSuccess={() => client.resumePausedMutations()}
  >
    {children}
  </PersistQueryClientProvider>
);
