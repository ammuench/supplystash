import type { AsyncStorage, PersistedClient, Persister } from "@tanstack/query-persist-client-core";

import { capture } from "@/lib/analytics";
import { PAUSED_MUTATIONS_KEY } from "@/lib/query-persister-config";

// Paused-mutation persister for `PersistQueryClientProvider`. Platform-free:
// components/query-provider.native.tsx passes it the kv-store adapter. See
// docs/persistence.md.
//
// `persistQueryClient` saves on every query and mutation cache event. Queries
// are never dehydrated into this blob, so most events produce the same blob,
// and those writes are skipped. A changed blob is written immediately rather
// than throttled, so a force-quit right after a check-off cannot lose it.
export const createMutationPersister = (storage: AsyncStorage<string>): Persister => {
  // `timestamp` changes on every save and only matters to `maxAge`, which is
  // Infinity, so it is left out of the comparison.
  const fingerprint = ({ buster, clientState }: PersistedClient) =>
    JSON.stringify({ buster, clientState });

  let lastWritten: string | undefined;

  return {
    persistClient: async (client) => {
      const next = fingerprint(client);
      if (next === lastWritten) {
        return;
      }

      try {
        await storage.setItem(PAUSED_MUTATIONS_KEY, JSON.stringify(client));
        // Only after the write lands, so a failed write is retried on the next
        // event instead of being skipped as already saved.
        lastWritten = next;
      } catch (error) {
        // TanStack fires saves without awaiting them, so a rethrow would only
        // become an unhandled rejection. A failed write can lose a queued
        // check-off on force-quit, so it is reported rather than swallowed.
        capture("paused_mutation_persist_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    restoreClient: async () => {
      try {
        const raw = await storage.getItem(PAUSED_MUTATIONS_KEY);
        if (!raw) {
          return undefined;
        }

        const client = JSON.parse(raw) as PersistedClient;
        // Without this the first cache event after restore rewrites the blob
        // that was just read.
        lastWritten = fingerprint(client);

        return client;
      } catch (error) {
        // TanStack discards the blob on a failed restore and only logs in dev,
        // so a queued check-off would vanish unseen. Rethrown so the discard
        // still happens: a blob that cannot be read cannot be resumed.
        capture("paused_mutation_restore_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    removeClient: async () => {
      lastWritten = undefined;
      await storage.removeItem(PAUSED_MUTATIONS_KEY);
    },
  };
};
