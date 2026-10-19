import type { PersistQueryClientOptions } from "@tanstack/query-persist-client-core";
import type { QueryClient } from "@tanstack/react-query";

import { persistQueryClientSave } from "@tanstack/query-persist-client-core";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { createMutationPersister } from "@/lib/mutation-persister";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";

const persistOptions = {
  persister: createMutationPersister(queryCacheStorage),
  // Same reasoning as the read cache: a check-off queued before a long trip is
  // still worth sending. Rows that changed shape are dropped by the shared
  // buster instead.
  maxAge: Infinity,
  buster: QUERY_CACHE_BUSTER,
  // Mutations only. `shouldDehydrateMutation` keeps its default, which saves
  // paused mutations and nothing else.
  dehydrateOptions: { shouldDehydrateQuery: () => false },
} satisfies Omit<PersistQueryClientOptions, "queryClient">;

/** Native version. Metro resolves this file on iOS/Android and
 * components/query-provider.tsx on web. Persists the paused (offline) mutation
 * queue so a queued write survives a force-quit, then replays it once the
 * restore finishes. The read cache has its own persister on
 * `defaultOptions.queries`; see docs/persistence.md.
 */
export const QueryProvider = ({
  client,
  children,
}: {
  client: QueryClient;
  children: React.ReactNode;
}) => (
  <PersistQueryClientProvider
    client={client}
    persistOptions={persistOptions}
    // Restored mutations sit paused until something resumes them. They need
    // their `mutationFn` from `setMutationDefaults`, registered before this
    // mounts (see lib/query-client.ts).
    onSuccess={() => {
      // Not returned: the provider holds `useIsRestoring()` until this
      // settles, and offline the replay does not settle until the network is
      // back, which would keep every query from reading the cache.
      //
      // The provider only starts saving after the restore, so a replay that
      // settles first never reaches disk and would replay again next launch.
      // One explicit save once the replays settle covers that.
      void client
        .resumePausedMutations()
        .then(() => persistQueryClientSave({ ...persistOptions, queryClient: client }));
    }}
  >
    {children}
  </PersistQueryClientProvider>
);
