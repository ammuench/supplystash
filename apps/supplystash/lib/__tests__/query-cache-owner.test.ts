import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";

import { capture } from "@/lib/analytics";
// Imported by their platform names: tsc resolves the bare paths to the web
// files. Jest runs as iOS either way.
import { pausedMutationPersister } from "@/lib/paused-mutation-persister.native";
import { claimQueryCache } from "@/lib/query-cache-owner.native";
import { restoreQueryCache } from "@/lib/query-cache-restore";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { skipPersistAfterWipe, wipeQueryCache } from "@/lib/query-cache-wipe";
import { openQueryCacheWrites } from "@/lib/query-cache-write-gate";
import { QUERY_CACHE_BUSTER, QUERY_CACHE_OWNER_KEY } from "@/lib/query-persister-config";
import { queryPersister } from "@/lib/query-persister.native";
import { queryKeys } from "@/state/query-keys";

jest.mock("@/lib/analytics", () => ({ capture: jest.fn() }));

// Set up by the expo-sqlite/kv-store mock in utils/testing/setupTests.ts.
const { __databases: databases } = jest.requireMock<{
  __databases: Map<string, Map<string, string>>;
}>("expo-sqlite/kv-store");

const cache = () => databases.get("query-cache")!;

const storageKey = (queryKey: QueryKey) => `tanstack-query-${hashKey(queryKey)}`;

const seed = (queryKey: QueryKey, data: unknown) => {
  cache().set(
    storageKey(queryKey),
    JSON.stringify({
      buster: QUERY_CACHE_BUSTER,
      queryHash: hashKey(queryKey),
      queryKey,
      state: { data, dataUpdatedAt: Date.now(), errorUpdatedAt: 0 },
    }),
  );
};

const ACCOUNT_A = "aaaaaaaa-0000-0000-0000-000000000000";
const ACCOUNT_B = "bbbbbbbb-0000-0000-0000-000000000000";

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
        persister: skipPersistAfterWipe(queryPersister.persisterFn),
      },
      mutations: { gcTime: Infinity },
    },
  });

// As the app boots: the boot pass restores what is on disk, then the session
// claims the cache.
const boot = async (userId: string, { wipeFails = false } = {}) => {
  const client = createClient();
  await restoreQueryCache(client, queryPersister);
  await claimQueryCache({
    userId,
    storage: queryCacheStorage,
    client,
    wipe: () => {
      // Armed here, not before the boot, which also lists every row.
      if (wipeFails) {
        jest.spyOn(queryCacheStorage, "entries").mockRejectedValueOnce(new Error("disk I/O error"));
      }
      return wipeQueryCache(queryPersister, pausedMutationPersister);
    },
  });
  return client;
};

// The persister saves on a scheduled tick after `queryFn` resolves.
const flushSave = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  cache().clear();
  jest.clearAllMocks();
  openQueryCacheWrites();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("# claimQueryCache", () => {
  describe("## rows left behind by an interrupted wipe", () => {
    it("never reaches a different account", async () => {
      seed(queryKeys.homes(), ["Account A's home"]);
      cache().set(QUERY_CACHE_OWNER_KEY, ACCOUNT_A);

      const client = await boot(ACCOUNT_B);

      expect(client.getQueryData(queryKeys.homes())).toBeUndefined();
      expect(cache().has(storageKey(queryKeys.homes()))).toBe(false);
      expect(cache().get(QUERY_CACHE_OWNER_KEY)).toBe(ACCOUNT_B);
    });

    it("is still restored for the same account before the first screen", async () => {
      seed(queryKeys.homes(), ["Account A's home"]);
      cache().set(QUERY_CACHE_OWNER_KEY, ACCOUNT_A);

      const client = await boot(ACCOUNT_A);

      expect(client.getQueryData(queryKeys.homes())).toEqual(["Account A's home"]);
      expect(cache().has(storageKey(queryKeys.homes()))).toBe(true);
    });
  });

  describe("## no recorded owner", () => {
    it("wipes, then records the account", async () => {
      // Installs from before the owner key, and any read it could not make,
      // cannot say whose rows these are.
      seed(queryKeys.homes(), ["Someone's home"]);

      const client = await boot(ACCOUNT_A);

      expect(client.getQueryData(queryKeys.homes())).toBeUndefined();
      expect(cache().has(storageKey(queryKeys.homes()))).toBe(false);
      expect(cache().get(QUERY_CACHE_OWNER_KEY)).toBe(ACCOUNT_A);
    });

    it("treats an unreadable owner as someone else's, and reports it", async () => {
      seed(queryKeys.homes(), ["Account A's home"]);
      cache().set(QUERY_CACHE_OWNER_KEY, ACCOUNT_A);
      jest.spyOn(queryCacheStorage, "getItem").mockRejectedValueOnce(new Error("disk I/O error"));

      await claimQueryCache({
        userId: ACCOUNT_A,
        storage: queryCacheStorage,
        client: createClient(),
        wipe: () => wipeQueryCache(queryPersister, pausedMutationPersister),
      });

      expect(cache().has(storageKey(queryKeys.homes()))).toBe(false);
      expect(capture).toHaveBeenCalledWith("query_cache_claim_failed", {
        message: "disk I/O error",
      });
    });
  });

  describe("## a failed wipe", () => {
    it("keeps the old owner, so the next launch wipes again", async () => {
      seed(queryKeys.homes(), ["Account A's home"]);
      cache().set(QUERY_CACHE_OWNER_KEY, ACCOUNT_A);

      const firstLaunch = await boot(ACCOUNT_B, { wipeFails: true });

      // Memory is cleared even though disk was not.
      expect(firstLaunch.getQueryData(queryKeys.homes())).toBeUndefined();
      expect(cache().has(storageKey(queryKeys.homes()))).toBe(true);
      expect(cache().get(QUERY_CACHE_OWNER_KEY)).toBe(ACCOUNT_A);

      const nextLaunch = await boot(ACCOUNT_B);

      expect(nextLaunch.getQueryData(queryKeys.homes())).toBeUndefined();
      expect(cache().has(storageKey(queryKeys.homes()))).toBe(false);
      expect(cache().get(QUERY_CACHE_OWNER_KEY)).toBe(ACCOUNT_B);
    });
  });

  describe("## after a mismatch", () => {
    it("lets the new account's fetches reach disk again", async () => {
      // The wipe closes the write gate; the claim runs for a signed-in user.
      cache().set(QUERY_CACHE_OWNER_KEY, ACCOUNT_A);

      const client = await boot(ACCOUNT_B);
      await client.fetchQuery({
        queryKey: queryKeys.homes(),
        queryFn: async () => ["Account B's home"],
      });
      await flushSave();

      expect(cache().has(storageKey(queryKeys.homes()))).toBe(true);
    });
  });
});
