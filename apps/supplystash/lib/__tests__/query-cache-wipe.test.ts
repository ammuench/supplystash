import type { PersistedClient } from "@tanstack/query-persist-client-core";

import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";

import { capture } from "@/lib/analytics";
// Imported by their platform names: tsc resolves the bare paths to the web
// files, where both persisters are undefined. Jest runs as iOS either way.
import { pausedMutationPersister } from "@/lib/paused-mutation-persister.native";
import { restoreQueryCache } from "@/lib/query-cache-restore";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { skipPersistAfterWipe, wipeQueryCache } from "@/lib/query-cache-wipe";
import { openQueryCacheWrites } from "@/lib/query-cache-write-gate";
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

// Each wipe closes the read cache to writes until the next sign-in.
beforeEach(() => {
  openQueryCacheWrites();
});

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

describe("# skipPersistAfterWipe", () => {
  const createPersistingClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          retry: false,
          persister: skipPersistAfterWipe(queryPersister.persisterFn),
        },
      },
    });

  // Holds `queryFn` open, so the test controls when the response lands.
  const heldResponse = <T>() => {
    let respond!: (data: T) => void;
    const response = new Promise<T>((resolve) => {
      respond = resolve;
    });
    return { response, respond };
  };

  // The persister saves on a scheduled tick after `queryFn` resolves.
  const flushSave = () => new Promise((resolve) => setTimeout(resolve, 10));

  beforeEach(() => {
    cache().clear();
  });

  it("does not let a refetch in flight at sign-out write the old account's row back", async () => {
    // staleTime 0 means refetches are common, and the network is far slower
    // than the SQLite delete, so the response usually lands after the wipe.
    const client = createPersistingClient();
    const key = queryKeys.homes();
    client.setQueryData(key, ["Account A's home"]);
    const { response, respond } = heldResponse<string[]>();
    const refetch = client.fetchQuery({ queryKey: key, queryFn: () => response });

    client.clear();
    await wipe();
    respond(["Account A's home"]);
    await refetch.catch(() => {});
    await flushSave();

    expect(cache().has(storageKey(key))).toBe(false);
  });

  it("does not let a save scheduled before sign-out land after the wipe", async () => {
    // The response landed before sign-out, so the check above passed, but
    // TanStack saves on a later tick. The wipe has listed the rows by then.
    const client = createPersistingClient();
    const key = queryKeys.homes();

    await client.fetchQuery({ queryKey: key, queryFn: async () => ["Account A's home"] });
    client.clear();
    await wipe();
    await flushSave();

    expect(cache().has(storageKey(key))).toBe(false);
  });

  it("still saves a fetch that no wipe interrupted", async () => {
    // The control for the test above: the same refetch without a sign-out
    // does reach disk, so the absence there is the guard's doing.
    const client = createPersistingClient();
    const key = queryKeys.homes();
    client.setQueryData(key, ["Home"]);
    const { response, respond } = heldResponse<string[]>();
    const refetch = client.fetchQuery({ queryKey: key, queryFn: () => response });

    respond(["Home"]);
    await refetch;
    await flushSave();

    expect(cache().has(storageKey(key))).toBe(true);
  });

  it("saves fetches that start after a wipe", async () => {
    // Only fetches that outlived a wipe are skipped, not every later one.
    await wipe();
    // As the next account's SIGNED_IN does.
    openQueryCacheWrites();
    const client = createPersistingClient();
    const key = queryKeys.homes();

    await client.fetchQuery({ queryKey: key, queryFn: async () => ["Account B's home"] });
    await flushSave();

    expect(cache().has(storageKey(key))).toBe(true);
  });
});
