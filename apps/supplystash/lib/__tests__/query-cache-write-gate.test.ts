import type { AsyncStorage } from "@tanstack/query-persist-client-core";

import {
  closeQueryCacheWrites,
  gateQueryCacheWrites,
  openQueryCacheWrites,
} from "@/lib/query-cache-write-gate";

const createStorage = () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    entries: jest.fn(async () => [...store.entries()]),
  } satisfies AsyncStorage<string>;

  return { store, storage };
};

beforeEach(() => {
  openQueryCacheWrites();
});

describe("# gateQueryCacheWrites", () => {
  it("drops writes while closed", async () => {
    // A save the previous account scheduled before the wipe, running after it.
    const { store, storage } = createStorage();
    const gated = gateQueryCacheWrites(storage);

    closeQueryCacheWrites();
    await gated.setItem("tanstack-query-homes", "Account A's home");

    expect(store.has("tanstack-query-homes")).toBe(false);
  });

  it("writes again once the next sign-in opens it", async () => {
    const { store, storage } = createStorage();
    const gated = gateQueryCacheWrites(storage);

    closeQueryCacheWrites();
    openQueryCacheWrites();
    await gated.setItem("tanstack-query-homes", "Account B's home");

    expect(store.get("tanstack-query-homes")).toBe("Account B's home");
  });

  it("still deletes while closed", async () => {
    const { store, storage } = createStorage();
    store.set("tanstack-query-homes", "Account A's home");
    const gated = gateQueryCacheWrites(storage);

    closeQueryCacheWrites();
    await gated.removeItem("tanstack-query-homes");

    expect(store.has("tanstack-query-homes")).toBe(false);
  });

  it("makes a listing wait for a write still in flight", async () => {
    // The wipe lists rows before deleting them. A write called before the
    // gate closed must be in that list, or it lands after the deletes.
    const { store, storage } = createStorage();
    let releaseWrite!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    storage.setItem.mockImplementationOnce(async (key: string, value: string) => {
      await gate;
      store.set(key, value);
    });
    const gated = gateQueryCacheWrites(storage);

    const write = gated.setItem("tanstack-query-homes", "Account A's home");
    closeQueryCacheWrites();
    const listed = gated.entries!();
    releaseWrite();

    await write;
    await expect(listed).resolves.toEqual([["tanstack-query-homes", "Account A's home"]]);
  });

  it("does not let a failed call block the ones queued after it", async () => {
    const { store, storage } = createStorage();
    storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    const gated = gateQueryCacheWrites(storage);

    const failed = gated.setItem("tanstack-query-homes", "first");
    const next = gated.setItem("tanstack-query-homes", "second");

    await expect(failed).rejects.toThrow("disk full");
    await next;
    expect(store.get("tanstack-query-homes")).toBe("second");
  });
});
