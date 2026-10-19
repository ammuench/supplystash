import type { AsyncStorage } from "@tanstack/query-persist-client-core";

import { SQLiteStorage } from "expo-sqlite/kv-store";

// Adapts expo-sqlite's kv-store to the storage shape TanStack's per-query
// persister expects. Native only: lib/query-persister.native.ts is the sole
// importer, so expo-sqlite (and its web wasm worker) never reaches the web
// bundle. See docs/persistence.md.
export const createKvStorage = (store: SQLiteStorage): AsyncStorage<string> => ({
  getItem: (key) => store.getItemAsync(key),
  setItem: (key, value) => store.setItemAsync(key, value),
  removeItem: async (key) => {
    await store.removeItemAsync(key);
  },
  // kv-store has no bulk read. Without `entries`, the persister's
  // `restoreQueries` and `persisterGc` cannot iterate the cache at all.
  entries: async () => {
    const keys = await store.getAllKeysAsync();
    const pairs = await Promise.all(
      keys.map(async (key) => [key, await store.getItemAsync(key)] as const),
    );

    return pairs.filter((pair): pair is [string, string] => pair[1] !== null);
  },
});

// A dedicated database rather than kv-store's shared default, so signing out
// can clear the query cache without touching anything else stored there.
export const queryCacheStorage = createKvStorage(new SQLiteStorage("query-cache"));
