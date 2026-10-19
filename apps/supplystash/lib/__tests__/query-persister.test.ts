import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react-native";

import { QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";
// Imported by its platform name: tsc resolves the bare path to the web file,
// where the persister is undefined. Jest runs as iOS either way.
import { queryPersister } from "@/lib/query-persister.native";
import { queryKeys } from "@/state/query-keys";

// Set up by the expo-sqlite/kv-store mock in utils/testing/setupTests.ts.
const { __databases: databases } = jest.requireMock<{
  __databases: Map<string, Map<string, string>>;
}>("expo-sqlite/kv-store");

const cache = () => databases.get("query-cache")!;

const storageKey = (queryKey: QueryKey) => `tanstack-query-${hashKey(queryKey)}`;

const seed = (queryKey: QueryKey, data: unknown, buster: string) => {
  cache().set(
    storageKey(queryKey),
    JSON.stringify({
      buster,
      queryHash: hashKey(queryKey),
      queryKey,
      state: { data, dataUpdatedAt: Date.now(), errorUpdatedAt: 0 },
    }),
  );
};

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { persister: queryPersister.persisterFn, gcTime: Infinity, retry: false },
    },
  });

describe("# queryPersister", () => {
  beforeEach(() => {
    cache().clear();
  });

  describe("## allowlist", () => {
    it("writes an allowlisted query to disk after it fetches", async () => {
      const key = queryKeys.items("home-1");

      await createClient().fetchQuery({ queryKey: key, queryFn: () => ["milk"] });

      await waitFor(() => expect(cache().has(storageKey(key))).toBe(true));
      expect(JSON.parse(cache().get(storageKey(key))!)).toMatchObject({
        buster: QUERY_CACHE_BUSTER,
        state: { data: ["milk"] },
      });
    });

    it("keeps a query outside the allowlist in memory only", async () => {
      const client = createClient();
      // Fetched alongside an allowlisted query, so the wait below proves the
      // persister has run rather than just not having run yet.
      await client.fetchQuery({ queryKey: queryKeys.items("home-1"), queryFn: () => [] });
      await client.fetchQuery({
        queryKey: queryKeys.itemHistory("home-1", "item-1"),
        queryFn: () => ["restocked"],
      });

      await waitFor(() => expect(cache().has(storageKey(queryKeys.items("home-1")))).toBe(true));
      expect(cache().has(storageKey(queryKeys.itemHistory("home-1", "item-1")))).toBe(false);
    });
  });

  describe("## restore", () => {
    it("serves the saved data to a fresh client before queryFn resolves", async () => {
      const key = queryKeys.homes();
      seed(key, ["Home"], QUERY_CACHE_BUSTER);

      // Never resolves: a cold start with no network.
      const queryFn = jest.fn(() => new Promise<string[]>(() => {}));

      await expect(createClient().fetchQuery({ queryKey: key, queryFn })).resolves.toEqual([
        "Home",
      ]);
    });

    it("ignores a non-allowlisted row on disk and runs queryFn", async () => {
      // The filter gates reads too, not just writes: a row left over from
      // before a root was dropped must not be served.
      const key = queryKeys.itemHistory("home-1", "item-1");
      seed(key, ["from disk"], QUERY_CACHE_BUSTER);

      const data = await createClient().fetchQuery({ queryKey: key, queryFn: () => ["fresh"] });

      expect(data).toEqual(["fresh"]);
    });

    it("discards an entry saved under a different buster and refetches", async () => {
      const key = queryKeys.categories("home-1");
      seed(key, ["stale"], "0:items");

      const data = await createClient().fetchQuery({ queryKey: key, queryFn: () => ["fresh"] });

      expect(data).toEqual(["fresh"]);
      await waitFor(() =>
        expect(JSON.parse(cache().get(storageKey(key))!)).toMatchObject({
          buster: QUERY_CACHE_BUSTER,
          state: { data: ["fresh"] },
        }),
      );
    });
  });

  describe("## garbage collection", () => {
    it("removes busted entries and keeps current ones", async () => {
      const busted = queryKeys.items("home-1");
      const current = queryKeys.items("home-2");
      seed(busted, [], "0:items");
      seed(current, [], QUERY_CACHE_BUSTER);

      await queryPersister.persisterGc();

      expect(cache().has(storageKey(busted))).toBe(false);
      expect(cache().has(storageKey(current))).toBe(true);
    });
  });
});
