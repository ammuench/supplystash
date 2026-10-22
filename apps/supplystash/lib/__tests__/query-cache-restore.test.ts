import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";

import { capture } from "@/lib/analytics";
import { restoreQueryCache } from "@/lib/query-cache-restore";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";
// Imported by its platform name: tsc resolves the bare path to the web file,
// where the persister is undefined. Jest runs as iOS either way.
import { queryPersister } from "@/lib/query-persister.native";
import { queryKeys } from "@/state/query-keys";

jest.mock("@/lib/analytics", () => ({ capture: jest.fn() }));

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

const createClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

describe("# restoreQueryCache", () => {
  beforeEach(() => {
    cache().clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads an allowlisted row into memory without running its query", async () => {
    const key = queryKeys.homes();
    seed(key, ["Home"], QUERY_CACHE_BUSTER);
    const client = createClient();

    await restoreQueryCache(client, queryPersister);

    expect(client.getQueryData(key)).toEqual(["Home"]);
  });

  it("deletes a busted row for a root outside the allowlist without querying it", async () => {
    // A root dropped from the allowlist changes the buster, so its rows are
    // busted. Lazy restore never reads them; this pass is their only cleanup.
    const key = queryKeys.itemHistory("home-1", "item-1");
    seed(key, ["restocked"], "0:items,itemHistory");
    const client = createClient();

    await restoreQueryCache(client, queryPersister);

    expect(cache().has(storageKey(key))).toBe(false);
    expect(client.getQueryCache().find({ queryKey: key })).toBeUndefined();
  });

  it("does not load a current row for a root outside the allowlist", async () => {
    const key = queryKeys.itemHistory("home-1", "item-1");
    seed(key, ["restocked"], QUERY_CACHE_BUSTER);
    const client = createClient();

    await restoreQueryCache(client, queryPersister);

    expect(client.getQueryData(key)).toBeUndefined();
  });

  it("reports a failed read instead of rejecting", async () => {
    // The splash waits on this pass, so a rejection would hold it forever.
    jest.spyOn(queryCacheStorage, "entries").mockRejectedValueOnce(new Error("disk I/O error"));

    await expect(restoreQueryCache(createClient(), queryPersister)).resolves.toBeUndefined();

    expect(capture).toHaveBeenCalledWith("query_cache_restore_failed", {
      message: "disk I/O error",
    });
  });

  it("does nothing on web, where there is no persister", async () => {
    const entries = jest.spyOn(queryCacheStorage, "entries");

    await expect(restoreQueryCache(createClient(), undefined)).resolves.toBeUndefined();

    expect(entries).not.toHaveBeenCalled();
  });
});
