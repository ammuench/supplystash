import type { AsyncStorage, PersistedClient } from "@tanstack/query-persist-client-core";

import { capture } from "@/lib/analytics";
import { createMutationPersister } from "@/lib/mutation-persister";
import { PAUSED_MUTATIONS_KEY } from "@/lib/query-persister-config";

jest.mock("@/lib/analytics", () => ({ capture: jest.fn() }));

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
  } satisfies AsyncStorage<string>;

  return { store, storage };
};

const client = (overrides: Partial<PersistedClient> = {}): PersistedClient => ({
  timestamp: 1,
  buster: "1:items",
  clientState: { mutations: [], queries: [] },
  ...overrides,
});

const withMutation = (variables: unknown) =>
  client({
    clientState: {
      queries: [],
      mutations: [
        {
          mutationKey: ["fixture"],
          state: {
            context: undefined,
            data: undefined,
            error: null,
            failureCount: 0,
            failureReason: null,
            isPaused: true,
            status: "pending",
            variables,
            submittedAt: 1,
          },
        },
      ],
    },
  });

describe("# createMutationPersister", () => {
  describe("## persistClient", () => {
    it("writes the client under the paused-mutations key", async () => {
      const { store, storage } = createStorage();

      await createMutationPersister(storage).persistClient(withMutation("milk"));

      expect(JSON.parse(store.get(PAUSED_MUTATIONS_KEY)!)).toEqual(withMutation("milk"));
    });

    it("skips the write when only the timestamp changed", async () => {
      // Every query event re-saves the blob with a new timestamp and nothing
      // else different. Those must not reach SQLite.
      const { storage } = createStorage();
      const persister = createMutationPersister(storage);

      await persister.persistClient(client({ timestamp: 1 }));
      await persister.persistClient(client({ timestamp: 2 }));

      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it("writes again when the mutations change", async () => {
      const { store, storage } = createStorage();
      const persister = createMutationPersister(storage);

      await persister.persistClient(client());
      await persister.persistClient(withMutation("milk"));

      expect(storage.setItem).toHaveBeenCalledTimes(2);
      expect(JSON.parse(store.get(PAUSED_MUTATIONS_KEY)!)).toEqual(withMutation("milk"));
    });

    it("writes again when the buster changes", async () => {
      const { storage } = createStorage();
      const persister = createMutationPersister(storage);

      await persister.persistClient(client({ buster: "1:items" }));
      await persister.persistClient(client({ buster: "2:items" }));

      expect(storage.setItem).toHaveBeenCalledTimes(2);
    });

    it("reports a failed write instead of rejecting", async () => {
      // TanStack does not await saves, so a rejection here would surface as
      // an unhandled promise rejection.
      const { storage } = createStorage();
      storage.setItem.mockRejectedValueOnce(new Error("disk full"));

      await expect(
        createMutationPersister(storage).persistClient(client()),
      ).resolves.toBeUndefined();

      expect(capture).toHaveBeenCalledWith("paused_mutation_persist_failed", {
        message: "disk full",
      });
    });

    it("retries a write that failed instead of treating it as saved", async () => {
      const { storage } = createStorage();
      storage.setItem.mockRejectedValueOnce(new Error("disk full"));
      const persister = createMutationPersister(storage);

      await persister.persistClient(client());
      await persister.persistClient(client());

      expect(storage.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe("## restoreClient", () => {
    it("returns undefined when nothing was saved", async () => {
      const { storage } = createStorage();

      await expect(createMutationPersister(storage).restoreClient()).resolves.toBeUndefined();
    });

    it("returns what a previous persister saved", async () => {
      const { storage } = createStorage();
      await createMutationPersister(storage).persistClient(withMutation("milk"));

      // A fresh instance, as after a force-quit.
      const restored = await createMutationPersister(storage).restoreClient();

      expect(restored).toEqual(withMutation("milk"));
    });

    it("reports and rethrows when the saved blob cannot be read", async () => {
      // Rethrowing is what makes TanStack discard the unreadable blob.
      const { store, storage } = createStorage();
      store.set(PAUSED_MUTATIONS_KEY, "{not json");

      await expect(createMutationPersister(storage).restoreClient()).rejects.toThrow(SyntaxError);

      expect(capture).toHaveBeenCalledWith("paused_mutation_restore_failed", {
        message: expect.any(String),
      });
    });

    it("does not rewrite the blob it just restored", async () => {
      const { storage } = createStorage();
      await createMutationPersister(storage).persistClient(withMutation("milk"));
      storage.setItem.mockClear();

      const persister = createMutationPersister(storage);
      await persister.restoreClient();
      await persister.persistClient(withMutation("milk"));

      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("## removeClient", () => {
    it("deletes the key and writes the next save even if it matches the old one", async () => {
      const { store, storage } = createStorage();
      const persister = createMutationPersister(storage);
      await persister.persistClient(client());

      await persister.removeClient();
      expect(store.has(PAUSED_MUTATIONS_KEY)).toBe(false);

      await persister.persistClient(client());
      expect(store.has(PAUSED_MUTATIONS_KEY)).toBe(true);
    });
  });
});
