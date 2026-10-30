import type { AsyncStorage } from "@tanstack/query-persist-client-core";

// Closed by the sign-out wipe, opened again by the next sign-in. No query runs
// while signed out, so any read-cache write in between is a save the previous
// account scheduled before the wipe and that ran after it. See
// docs/persistence.md.
let isOpen = true;

export const closeQueryCacheWrites = () => {
  isOpen = false;
};

export const openQueryCacheWrites = () => {
  isOpen = true;
};

/**
 * Wraps the read persister's storage so a sign-out wipe cannot miss a save.
 *
 * TanStack saves a row on a scheduled tick after the response lands, so a save
 * can start after the wipe was called. The gate drops it: checked on the call,
 * so a save that was already called still lands, and the queue makes the wipe
 * wait for it.
 *
 * Every call runs in order, one at a time. `removeQueries` lists the rows and
 * then deletes them, and a save still in flight when it lists them would
 * otherwise land after the deletes.
 */
export const gateQueryCacheWrites = (storage: AsyncStorage<string>): AsyncStorage<string> => {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T> | T) => {
    const run = queue.then(task);
    // A rejected call still rejects for its own caller, but must not block
    // the calls queued after it.
    queue = run.catch(() => {});
    return run;
  };

  return {
    getItem: (key) => serialize(() => storage.getItem(key)),
    setItem: async (key, value) => {
      if (!isOpen) {
        return;
      }

      await serialize(() => storage.setItem(key, value));
    },
    removeItem: (key) => serialize(() => storage.removeItem(key)),
    // Looked up on each call, not bound once, so tests can spy on the
    // underlying storage.
    entries: storage.entries && (() => serialize(() => storage.entries!())),
  };
};
