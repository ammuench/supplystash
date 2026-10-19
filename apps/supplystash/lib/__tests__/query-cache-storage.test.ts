import { SQLiteStorage } from "expo-sqlite/kv-store";

import { createKvStorage, queryCacheStorage } from "@/lib/query-cache-storage";

// Set up by the expo-sqlite/kv-store mock in utils/testing/setupTests.ts.
const { __databases: databases } = jest.requireMock<{
  __databases: Map<string, Map<string, string>>;
}>("expo-sqlite/kv-store");

describe("# createKvStorage", () => {
  const store = new SQLiteStorage("test");
  const storage = createKvStorage(store);

  beforeEach(async () => {
    await store.clearAsync();
  });

  it("round-trips a value", async () => {
    await storage.setItem("a", "1");

    expect(await storage.getItem("a")).toBe("1");
  });

  it("returns null for a key that was never written", async () => {
    expect(await storage.getItem("missing")).toBeNull();
  });

  it("removes a value", async () => {
    await storage.setItem("a", "1");
    await storage.removeItem("a");

    expect(await storage.getItem("a")).toBeNull();
  });

  it("lists every stored pair through entries()", async () => {
    await storage.setItem("a", "1");
    await storage.setItem("b", "2");

    expect(await storage.entries!()).toEqual(
      expect.arrayContaining([
        ["a", "1"],
        ["b", "2"],
      ]),
    );
    expect(await storage.entries!()).toHaveLength(2);
  });
});

describe("# queryCacheStorage", () => {
  it("writes to its own database, not kv-store's shared default", async () => {
    await queryCacheStorage.setItem("a", "1");

    expect(databases.get("query-cache")?.get("a")).toBe("1");
    expect(databases.get("ExpoSQLiteStorage")?.get("a")).toBeUndefined();
  });
});
