import { Stack } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";

import { RootNavigator } from "@/components/root-navigator";
import { Text } from "@/components/ui/text";

// A tiny external store stands in for SessionProvider, so a test can change
// the session after mount and the navigator re-renders like it would for real.
const mockSessionStore = {
  value: { session: null as unknown, isLoading: false },
  listeners: new Set<() => void>(),
  set(next: { session: unknown; isLoading: boolean }) {
    this.value = next;
    this.listeners.forEach((listener) => listener());
  },
};

jest.mock("@/state/session", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSyncExternalStore } = require("react") as typeof import("react");

  return {
    useSession: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockSessionStore.listeners.add(listener);
          return () => mockSessionStore.listeners.delete(listener);
        },
        () => mockSessionStore.value,
      ),
  };
});
// utils/testing/setupTests.ts stubs expo-linking down to `createURL` for the
// auth suites; the router needs the real module to subscribe to URLs.
jest.mock("expo-linking", () => jest.requireActual("expo-linking"));

const SIGNED_IN = { session: { user: { id: "user-1" } }, isLoading: false };
const SIGNED_OUT = { session: null, isLoading: false };

const GroupLayout = () => <Stack screenOptions={{ headerShown: false }} />;

// Stub routes with the same shape as app/: only the guards are under test.
const routes = {
  _layout: () => <RootNavigator />,
  "(app)/_layout": GroupLayout,
  "(app)/index": () => <Text>Inventory</Text>,
  "(auth)/_layout": {
    default: GroupLayout,
    unstable_settings: { initialRouteName: "sign-in" },
  },
  "(auth)/sign-in": () => <Text>Sign in</Text>,
  "(auth)/sign-up": () => <Text>Sign up</Text>,
  "auth-callback": () => <Text>Finishing sign-in</Text>,
};

beforeEach(() => {
  mockSessionStore.listeners.clear();
});

describe("# RootNavigator", () => {
  describe("## cold start at /", () => {
    // The URL stays "/" while the guard shows the (auth) group, so these
    // assert on what is on screen rather than the pathname.
    it("### signed out shows sign-in, never the tabs", () => {
      mockSessionStore.value = SIGNED_OUT;

      renderRouter(routes, { initialUrl: "/" });

      expect(screen.getByText("Sign in")).toBeOnTheScreen();
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### signed in shows the inventory tab", () => {
      mockSessionStore.value = SIGNED_IN;

      renderRouter(routes, { initialUrl: "/" });

      expect(screen.getByText("Inventory")).toBeOnTheScreen();
      expect(screen.queryByText("Sign in")).not.toBeOnTheScreen();
    });

    it("### renders nothing while the session is loading", () => {
      mockSessionStore.value = { session: null, isLoading: true };

      renderRouter(routes, { initialUrl: "/" });

      expect(screen.queryByText("Sign in")).not.toBeOnTheScreen();
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });
  });

  describe("## session changes", () => {
    it("### signing out moves to sign-in", () => {
      mockSessionStore.value = SIGNED_IN;
      renderRouter(routes, { initialUrl: "/" });

      act(() => mockSessionStore.set(SIGNED_OUT));

      expect(screen.getByText("Sign in")).toBeOnTheScreen();
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### signing in moves to the inventory tab", () => {
      mockSessionStore.value = SIGNED_OUT;
      renderRouter(routes, { initialUrl: "/sign-in" });

      act(() => mockSessionStore.set(SIGNED_IN));

      expect(screen.getByText("Inventory")).toBeOnTheScreen();
      expect(screen.queryByText("Sign in")).not.toBeOnTheScreen();
    });
  });

  describe("## auth-callback", () => {
    it("### is reachable while signed out", () => {
      mockSessionStore.value = SIGNED_OUT;

      renderRouter(routes, { initialUrl: "/auth-callback" });

      expect(screen.getByText("Finishing sign-in")).toBeOnTheScreen();
    });
  });
});
