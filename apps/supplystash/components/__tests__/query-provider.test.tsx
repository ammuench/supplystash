import type { PersistedClient } from "@tanstack/query-persist-client-core";

import { PostgrestError } from "@supabase/supabase-js";
import { onlineManager, QueryClient, useIsRestoring } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

// Imported by its platform name: tsc resolves the bare path to the web file,
// which has no persister. Jest runs as iOS either way.
import { QueryProvider } from "@/components/query-provider.native";
import { postgrestErrorCode } from "@/lib/postgrest-error";
import { PAUSED_MUTATIONS_KEY, QUERY_CACHE_BUSTER } from "@/lib/query-persister-config";

// Set up by the expo-sqlite/kv-store mock in utils/testing/setupTests.ts.
const { __databases: databases } = jest.requireMock<{
  __databases: Map<string, Map<string, string>>;
}>("expo-sqlite/kv-store");

const cache = () => databases.get("query-cache")!;

const savedClient = () => {
  const raw = cache().get(PAUSED_MUTATIONS_KEY);
  return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
};

// Stands in for the shopping-list check-off until Project 7 builds it.
const FIXTURE_KEY = ["fixture", "checkOff"];

// Each call is one app launch: a fresh client with the defaults registered at
// module scope, as lib/query-client.ts requires of real offline mutations.
const launch = (options: {
  mutationFn: (itemId: string) => Promise<unknown>;
  onError?: (error: unknown) => void;
}) => {
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: 0, gcTime: Infinity } },
  });
  client.setMutationDefaults(FIXTURE_KEY, options);

  const RestoreProbe = () => <Text>{useIsRestoring() ? "restoring" : "restored"}</Text>;
  const view = render(
    <QueryProvider client={client}>
      <RestoreProbe />
    </QueryProvider>,
  );

  return { client, view, restored: () => screen.findByText("restored") };
};

// Queues a check-off offline and waits until it is on disk, then force-quits.
const queueOfflineThenQuit = async (itemId: string) => {
  const { client, view, restored } = launch({ mutationFn: jest.fn() });
  // Saving only starts once the restore finishes.
  await restored();

  onlineManager.setOnline(false);
  void client.getMutationCache().build(client, { mutationKey: FIXTURE_KEY }).execute(itemId);

  await waitFor(() =>
    expect(savedClient()?.clientState.mutations).toEqual([
      expect.objectContaining({
        mutationKey: FIXTURE_KEY,
        state: expect.objectContaining({ isPaused: true, variables: itemId }),
      }),
    ]),
  );

  view.unmount();
};

describe("# QueryProvider (native)", () => {
  beforeEach(() => {
    cache().clear();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  describe("## paused mutations", () => {
    it("replays a check-off queued before a force-quit", async () => {
      await queueOfflineThenQuit("item-1");

      onlineManager.setOnline(true);
      const mutationFn = jest.fn(async () => ({ id: "item-1" }));
      launch({ mutationFn });

      await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
      expect(mutationFn.mock.calls[0]).toEqual(["item-1", expect.anything()]);
      // Settled mutations are not paused, so the queue on disk empties.
      await waitFor(() => expect(savedClient()?.clientState.mutations).toEqual([]));
    });

    it("hands the PostgREST error code to onError when the replay is rejected", async () => {
      await queueOfflineThenQuit("item-1");

      onlineManager.setOnline(true);
      const onError = jest.fn();
      launch({
        mutationFn: async () => {
          throw new PostgrestError({
            message: "new row violates row-level security policy",
            details: "",
            hint: "",
            code: "42501",
          });
        },
        onError,
      });

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(postgrestErrorCode(onError.mock.calls[0][0])).toBe("42501");
      // A rejected write is settled, not paused, so it is not replayed again.
      await waitFor(() => expect(savedClient()?.clientState.mutations).toEqual([]));
    });

    it("clears a settled replay from disk while another is still in flight", async () => {
      // Queue two check-offs offline, then force-quit.
      const first = launch({ mutationFn: jest.fn() });
      await first.restored();
      onlineManager.setOnline(false);
      for (const itemId of ["item-fast", "item-slow"]) {
        void first.client
          .getMutationCache()
          .build(first.client, { mutationKey: FIXTURE_KEY })
          .execute(itemId);
      }
      await waitFor(() => expect(savedClient()?.clientState.mutations).toHaveLength(2));
      first.view.unmount();

      // item-fast settles before the provider starts saving, item-slow is
      // held open. Nothing else fires a cache event after that.
      onlineManager.setOnline(true);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const mutationFn = jest.fn(async (itemId: string) => {
        if (itemId === "item-slow") {
          await gate;
        }
        return { id: itemId };
      });
      launch({ mutationFn });

      await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
      // In-flight replays are not paused, so neither belongs on disk. Before
      // the fix item-fast stayed there until item-slow settled.
      await waitFor(() => expect(savedClient()?.clientState.mutations).toEqual([]));

      release();
    });

    it("finishes restoring while offline, leaving the queue paused on disk", async () => {
      // An unsettled replay must not hold `useIsRestoring()`, or no query
      // could read the cache until the network is back.
      await queueOfflineThenQuit("item-1");

      const mutationFn = jest.fn(async () => ({}));
      const { restored } = launch({ mutationFn });

      await restored();
      expect(mutationFn).not.toHaveBeenCalled();
      expect(savedClient()?.clientState.mutations).toHaveLength(1);
    });

    it("drops a queue saved under a different buster without replaying it", async () => {
      await queueOfflineThenQuit("item-1");
      cache().set(
        PAUSED_MUTATIONS_KEY,
        JSON.stringify({ ...savedClient(), buster: `old:${QUERY_CACHE_BUSTER}` }),
      );

      onlineManager.setOnline(true);
      const mutationFn = jest.fn(async () => ({}));
      const { restored } = launch({ mutationFn });

      await restored();
      expect(mutationFn).not.toHaveBeenCalled();
      // The busted queue is gone; what is left is this launch's empty one.
      await waitFor(() =>
        expect(savedClient()).toMatchObject({
          buster: QUERY_CACHE_BUSTER,
          clientState: { mutations: [] },
        }),
      );
    });
  });
});
