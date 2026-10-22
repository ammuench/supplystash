import type { PersistedClient } from "@tanstack/query-persist-client-core";

import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";

import { capture } from "@/lib/analytics";
// Imported by their platform names: tsc resolves the bare paths to the web
// files, where both persisters are undefined. Jest runs as iOS either way.
import { pausedMutationPersister } from "@/lib/paused-mutation-persister.native";
import { restoreQueryCache } from "@/lib/query-cache-restore";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { wipeQueryCache } from "@/lib/query-cache-wipe";
import { PAUSED_MUTATIONS_KEY, QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";
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

// A blob holding one paused check-off. Only its presence on disk matters here.
const queuedBlob = (): PersistedClient => ({
  timestamp: Date.now(),
  buster: QUERY_CACHE_BUSTER,
  clientState: {
    queries: [],
    mutations: [{ mutationKey: ["checkOff"], state: { isPaused: true } } as never],
  },
});

const wipe = () => wipeQueryCache(queryPersister, pausedMutationPersister);

describe("# wipeQueryCache", () => {
  beforeEach(() => {
    cache().clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes every read-cache row and the paused-mutation blob", async () => {
    seed(queryKeys.homes(), ["Home"], QUERY_CACHE_BUSTER);
    seed(queryKeys.categories("home-1"), ["Pantry"], QUERY_CACHE_BUSTER);
    cache().set(PAUSED_MUTATIONS_KEY, JSON.stringify(queuedBlob()));

    await wipe();

    expect(cache().size).toBe(0);
  });

  it("deletes rows outside the allowlist too, busted or not", async () => {
    seed(queryKeys.itemHistory("home-1", "item-1"), ["restocked"], QUERY_CACHE_BUSTER);
    seed(queryKeys.itemHistory("home-1", "item-2"), ["used"], "0:items,itemHistory");

    await wipe();

    expect(cache().size).toBe(0);
  });

  it("does not let a save still in flight put the blob back after the delete", async () => {
    // TanStack fires saves without awaiting them, so one can still be pending
    // when sign-out starts the wipe.
    const pendingSave = pausedMutationPersister.persistClient(queuedBlob());

    await wipe();
    await pendingSave;

    expect(cache().has(PAUSED_MUTATIONS_KEY)).toBe(false);
  });

  it("leaves the next account nothing to restore", async () => {
    // The ticket's case: `["homes"]` is not user-scoped, so a surviving row
    // shows the previous account's homes to whoever signs in next.
    seed(queryKeys.homes(), ["Account A's home"], QUERY_CACHE_BUSTER);

    await wipe();
    const nextAccount = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    await restoreQueryCache(nextAccount, queryPersister);

    expect(nextAccount.getQueryData(queryKeys.homes())).toBeUndefined();
  });

  it("still deletes the blob when the read cache fails, and reports instead of rejecting", async () => {
    jest.spyOn(queryCacheStorage, "entries").mockRejectedValueOnce(new Error("disk I/O error"));
    cache().set(PAUSED_MUTATIONS_KEY, JSON.stringify(queuedBlob()));

    await expect(wipe()).resolves.toBeUndefined();

    expect(cache().has(PAUSED_MUTATIONS_KEY)).toBe(false);
    expect(capture).toHaveBeenCalledWith("query_cache_wipe_failed", { message: "disk I/O error" });
  });

  it("does nothing on web, where there are no persisters", async () => {
    const entries = jest.spyOn(queryCacheStorage, "entries");

    await expect(wipeQueryCache(undefined, undefined)).resolves.toBeUndefined();

    expect(entries).not.toHaveBeenCalled();
  });
});
