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

  // TanStack fires saves without awaiting them, so they can overlap. Each
  // write runs only after the one before it lands, and compares against
  // `lastWritten` only then. Otherwise empty -> paused -> empty skips the final
  // save as matching the first, and the pending paused write lands last.
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>) => {
    const run = queue.then(task);
    // A rejected task still rejects for its own caller, but must not block
    // the writes queued after it.
    queue = run.catch(() => {});
    return run;
  };

  const readClient = async () => {
    try {
      const raw = await storage.getItem(PAUSED_MUTATIONS_KEY);
      if (!raw) {
        // The disk may have been cleared behind this persister's back.
        // Forgetting the last write keeps the next save from being skipped
        // as already on disk.
        lastWritten = undefined;
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
  };

  // Bumped by every `removeClient` call. A restore that was already reading
  // when a sign-out wiped the blob compares against it and drops what it read.
  let removals = 0;

  return {
    persistClient: (client) =>
      serialize(async () => {
        try {
          const next = fingerprint(client);
          if (next === lastWritten) {
            return;
          }

          await storage.setItem(PAUSED_MUTATIONS_KEY, JSON.stringify(client));
          // Only after the write lands, so a failed write is retried on the
          // next event instead of being skipped as already saved.
          lastWritten = next;
        } catch (error) {
          // A rethrow would only become an unhandled rejection, since nothing
          // awaits the save. A failed write can lose a queued check-off on
          // force-quit, so it is reported rather than swallowed. Fingerprinting
          // is inside the try because a BigInt or circular value throws there.
          capture("paused_mutation_persist_failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    // Queued, and checked against `removals`, so a sign-out wipe during the
    // boot restore cannot be undone by it. TanStack hydrates and replays
    // whatever this returns, and its next save writes it back to disk, so a
    // blob read just before the wipe would bring the old account's check-offs
    // back. Dropped rather than replayed: a sign-out discards queued
    // check-offs.
    restoreClient: () => {
      const removalsAtStart = removals;

      return serialize(async () => {
        const restored = await readClient();

        return removals === removalsAtStart ? restored : undefined;
      });
    },
    // Queued too, so a write still pending cannot land after the delete and
    // put the blob back.
    removeClient: () => {
      // Counted on the call, not when the queued delete runs, so a restore
      // already reading sees it.
      removals += 1;

      return serialize(async () => {
        lastWritten = undefined;
        await storage.removeItem(PAUSED_MUTATIONS_KEY);
      });
    },
  };
};
