// Global test setup. Loaded by jest before every suite (see the `jest` block in
// package.json), so anything mocked here is mocked everywhere.

// Native haptics have no JS implementation under jest-expo; the wrapper in
// lib/haptics.ts already swallows errors, but silencing it here keeps the
// module registry from loading the native binding at all.
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// AsyncStorage is a native module. The package ships its own jest mock — an
// in-memory implementation — which is what the maintainers recommend over
// hand-rolling one.
jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock") as unknown,
);

// lib/env.ts throws when the config is missing, which is the behaviour we want
// at runtime but would fail every suite that transitively imports it. Supply
// the same shape app.config.ts builds from the environment.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: "http://127.0.0.1:54321",
        supabasePublishableKey: "sb_publishable_test",
      },
    },
  },
}));

// react-native-keyboard-controller is a native module with no JS fallback —
// importing it under jest throws "doesn't seem to be linked". The package ships
// its own mock (ScrollView/View stand-ins for the keyboard-aware components),
// which is what components/app-safe-screen.tsx needs to render at all.
jest.mock(
  "react-native-keyboard-controller",
  () => require("react-native-keyboard-controller/jest") as unknown,
);

// @tanstack/form-core opens a devtools socket and retries on a 1s setInterval
// that nothing clears, so every suite rendering a form leaves an open handle and
// jest force-exits its worker. The devtools bridge is inert under test anyway.
jest.mock("@tanstack/devtools-event-client", () => ({
  EventClient: class {
    on() {
      return () => {};
    }
    emit() {}
  },
}));

// The polyfill is a native module with no jest implementation; the crypto shim
// below stands in for what it provides.
jest.mock("react-native-get-random-values", () => ({}));

// SecureStore is backed by the iOS keychain / Android keystore, neither of
// which exists under jest. An in-memory map keeps the real behaviour that
// matters to callers — a value written can be read back — so LargeSecureStore
// can be round-tripped for real rather than asserted against a stub that always
// returns null.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();

  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// `crypto.getRandomValues` comes from react-native-get-random-values, which is a
// native module with no jest implementation. Node's own webcrypto satisfies the
// same contract, so LargeSecureStore generates real AES keys in tests.
if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  globalThis.crypto = require("node:crypto").webcrypto;
}
