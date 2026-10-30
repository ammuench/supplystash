import type { NetworkState } from "expo-network";

import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react-native";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { Platform } from "react-native";

import { wireConnectivity } from "@/lib/connectivity";

// Mocked in utils/testing/setupTests.ts.
const addListener = jest.mocked(addNetworkStateListener);
const readState = jest.mocked(getNetworkStateAsync);

const CONNECTED = { type: "WIFI", isConnected: true } as NetworkState;
const DISCONNECTED = { type: "NONE", isConnected: false } as NetworkState;

// What the OS reports next, through the listener the last wiring registered.
const emit = (state: NetworkState) => addListener.mock.lastCall![0](state);

// An initial read the test resolves by hand, to order it against an event.
const holdInitialRead = () => {
  let resolve: (state: NetworkState) => void = () => {};
  readState.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );

  return (state: NetworkState) => resolve(state);
};

// `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
const createClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: Infinity },
      mutations: { retry: 0, gcTime: Infinity },
    },
  });
  // What QueryClientProvider does on mount: subscribe to online and focus.
  client.mount();

  return client;
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("# wireConnectivity", () => {
  describe("## online state (native)", () => {
    it("goes offline when the device disconnects, and back online when it reconnects", () => {
      wireConnectivity();

      emit(DISCONNECTED);
      expect(onlineManager.isOnline()).toBe(false);

      emit(CONNECTED);
      expect(onlineManager.isOnline()).toBe(true);
    });

    it("stays online while the connection state is unknown", () => {
      wireConnectivity();

      emit({ type: "UNKNOWN" } as NetworkState);

      expect(onlineManager.isOnline()).toBe(true);
    });

    it("starts offline when the app launches with no connection", async () => {
      // The listener only fires on a change, so only the initial read can
      // know the device was offline before the app started.
      readState.mockResolvedValueOnce(DISCONNECTED);

      wireConnectivity();

      await waitFor(() => expect(onlineManager.isOnline()).toBe(false));
    });

    it("drops the initial read when a change arrives before it", async () => {
      const resolveRead = holdInitialRead();
      wireConnectivity();

      emit(DISCONNECTED);
      // Taken before the disconnect, so it is out of date.
      resolveRead(CONNECTED);
      await Promise.resolve();

      expect(onlineManager.isOnline()).toBe(false);
    });

    it("drops an initial read that settles after the wiring is replaced", async () => {
      const resolveRead = holdInitialRead();
      wireConnectivity();
      onlineManager.setEventListener(() => undefined);

      resolveRead(DISCONNECTED);
      await Promise.resolve();

      expect(onlineManager.isOnline()).toBe(true);
    });
  });

  describe("## TanStack behaviour it enables", () => {
    it("pauses a mutation while offline and runs it on reconnect", async () => {
      wireConnectivity();
      const client = createClient();
      const mutationFn = jest.fn(async (itemId: string) => itemId);

      emit(DISCONNECTED);
      const mutation = client.getMutationCache().build(client, { mutationFn });
      void mutation.execute("item-1");

      await waitFor(() => expect(mutation.state.isPaused).toBe(true));
      expect(mutationFn).not.toHaveBeenCalled();

      emit(CONNECTED);

      await waitFor(() => expect(mutation.state.status).toBe("success"));
      expect(mutationFn).toHaveBeenCalledWith("item-1", expect.anything());

      client.unmount();
    });

    it("refetches a watched query on reconnect", async () => {
      wireConnectivity();
      const client = createClient();
      const queryFn = jest.fn(async () => "rows");
      const observer = new QueryObserver(client, { queryKey: ["fixture"], queryFn });
      const unsubscribe = observer.subscribe(() => {});

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      emit(DISCONNECTED);
      emit(CONNECTED);

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

      unsubscribe();
      client.unmount();
    });
  });

  describe("## web", () => {
    it("leaves TanStack's own online events in place", () => {
      jest.replaceProperty(Platform, "OS", "web");

      wireConnectivity();

      expect(addListener).not.toHaveBeenCalled();
      expect(readState).not.toHaveBeenCalled();
    });
  });
});
