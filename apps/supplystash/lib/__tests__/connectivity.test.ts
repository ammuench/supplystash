import type { NetworkState } from "expo-network";
import type { AppStateStatus } from "react-native";

import { focusManager, onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react-native";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { AppState, Platform } from "react-native";

import { whenOnlineStateKnown, wireConnectivity } from "@/lib/connectivity";

// Mocked in utils/testing/setupTests.ts.
const addListener = jest.mocked(addNetworkStateListener);
const readState = jest.mocked(getNetworkStateAsync);

const CONNECTED = { type: "WIFI", isConnected: true } as NetworkState;
const DISCONNECTED = { type: "NONE", isConnected: false } as NetworkState;

// What the OS reports next, through the listener the last wiring registered.
const emit = (state: NetworkState) => addListener.mock.lastCall![0](state);

// Replaced per test so no real AppState listener is registered.
let appStateListen: jest.SpiedFunction<typeof AppState.addEventListener>;

// The app moving to the foreground or background.
const changeAppState = (status: AppStateStatus) => appStateListen.mock.lastCall![1](status);

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

// Whether `whenOnlineStateKnown()` has settled, after pending callbacks run.
const isKnown = async () => {
  let known = false;
  void whenOnlineStateKnown().then(() => {
    known = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  return known;
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
  appStateListen = jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  jest.restoreAllMocks();
  onlineManager.setOnline(true);
  // Back to TanStack's default: focused unless the document is hidden.
  focusManager.setFocused(undefined);
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

  describe("## whenOnlineStateKnown (native)", () => {
    it("waits for the initial read", async () => {
      const resolveRead = holdInitialRead();
      wireConnectivity();

      expect(await isKnown()).toBe(false);

      resolveRead(DISCONNECTED);

      expect(await isKnown()).toBe(true);
    });

    it("settles on a change that arrives before the initial read", async () => {
      holdInitialRead();
      wireConnectivity();

      emit(DISCONNECTED);

      expect(await isKnown()).toBe(true);
    });

    it("settles when the initial read fails", async () => {
      // Otherwise the paused queue would never replay.
      readState.mockRejectedValueOnce(new Error("native module unavailable"));
      wireConnectivity();

      expect(await isKnown()).toBe(true);
    });
  });

  describe("## focus state (native)", () => {
    it("loses focus in the background and regains it in the foreground", () => {
      wireConnectivity();

      changeAppState("background");
      expect(focusManager.isFocused()).toBe(false);

      changeAppState("active");
      expect(focusManager.isFocused()).toBe(true);
    });

    it("loses focus while iOS overlays the app", () => {
      // Control Center, the app switcher, an incoming call.
      wireConnectivity();

      changeAppState("inactive");

      expect(focusManager.isFocused()).toBe(false);
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

    it("refetches a watched query when the app returns to the foreground", async () => {
      wireConnectivity();
      const client = createClient();
      const queryFn = jest.fn(async () => "rows");
      const observer = new QueryObserver(client, { queryKey: ["fixture"], queryFn });
      const unsubscribe = observer.subscribe(() => {});

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      changeAppState("background");
      changeAppState("active");

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

      unsubscribe();
      client.unmount();
    });
  });

  describe("## web", () => {
    it("leaves TanStack's own online and focus events in place", () => {
      jest.replaceProperty(Platform, "OS", "web");

      wireConnectivity();

      expect(addListener).not.toHaveBeenCalled();
      expect(readState).not.toHaveBeenCalled();
      expect(appStateListen).not.toHaveBeenCalled();
    });

    it("never holds anything waiting on the online state", async () => {
      jest.replaceProperty(Platform, "OS", "web");

      wireConnectivity();

      expect(await isKnown()).toBe(true);
    });
  });
});
