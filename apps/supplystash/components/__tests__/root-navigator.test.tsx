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
// Restored unless a test says otherwise. Mocked so the real module's boot
// restore pass does not run in this suite.
const mockIsQueryCacheRestored = jest.fn(() => true);
jest.mock("@/lib/query-cache-restore", () => ({
  useIsQueryCacheRestored: () => mockIsQueryCacheRestored(),
}));
const mockIsQueryCacheClaimed = jest.fn((_userId: string | undefined) => true);
jest.mock("@/hooks/use-is-query-cache-claimed", () => ({
  useIsQueryCacheClaimed: (userId: string | undefined) => mockIsQueryCacheClaimed(userId),
}));
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
    unstable_settings: { anchor: "sign-in" },
  },
  "(auth)/sign-in": () => <Text>Sign in</Text>,
  "(auth)/sign-up": () => <Text>Sign up</Text>,
  "auth-callback": () => <Text>Finishing sign-in</Text>,
};

beforeEach(() => {
  mockSessionStore.listeners.clear();
  mockIsQueryCacheRestored.mockReturnValue(true);
  mockIsQueryCacheClaimed.mockReturnValue(true);
});

describe("# RootNavigator", () => {
  describe("## cold start at /", () => {
    // These assert on what is on screen rather than the pathname: the guard's
    // redirect target is the router's concern, the visible group is ours.
    it("### signed out shows sign-in, never the tabs", async () => {
      mockSessionStore.value = SIGNED_OUT;

      await renderRouter(routes, { initialUrl: "/" });

      expect(screen.getByText("Sign in")).toBeOnTheScreen();
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### signed in shows the inventory tab", async () => {
      mockSessionStore.value = SIGNED_IN;

      await renderRouter(routes, { initialUrl: "/" });

      expect(screen.getByText("Inventory")).toBeOnTheScreen();
      expect(screen.queryByText("Sign in")).not.toBeOnTheScreen();
    });

    it("### renders nothing while the session is loading", async () => {
      mockSessionStore.value = { session: null, isLoading: true };

      await renderRouter(routes, { initialUrl: "/" });

      expect(screen.queryByText("Sign in")).not.toBeOnTheScreen();
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### renders nothing while the read cache is restoring", async () => {
      // A screen mounted now could fetch, then have the restore pass
      // overwrite its fresh data with the older copy from disk.
      mockSessionStore.value = SIGNED_IN;
      mockIsQueryCacheRestored.mockReturnValue(false);

      await renderRouter(routes, { initialUrl: "/" });

      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### renders nothing until the read cache is claimed for the signed-in user", async () => {
      // Until then the cache may hold another account's rows.
      mockSessionStore.value = SIGNED_IN;
      mockIsQueryCacheClaimed.mockReturnValue(false);

      await renderRouter(routes, { initialUrl: "/" });

      expect(mockIsQueryCacheClaimed).toHaveBeenCalledWith("user-1");
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### signed out shows sign-in without waiting for a claim", async () => {
      mockSessionStore.value = SIGNED_OUT;
      mockIsQueryCacheClaimed.mockReturnValue(false);

      await renderRouter(routes, { initialUrl: "/" });

      expect(screen.getByText("Sign in")).toBeOnTheScreen();
    });
  });

  describe("## session changes", () => {
    it("### signing out moves to sign-in", async () => {
      mockSessionStore.value = SIGNED_IN;
      await renderRouter(routes, { initialUrl: "/" });

      act(() => mockSessionStore.set(SIGNED_OUT));

      expect(screen.getByText("Sign in")).toBeOnTheScreen();
      expect(screen.queryByText("Inventory")).not.toBeOnTheScreen();
    });

    it("### signing in moves to the inventory tab", async () => {
      mockSessionStore.value = SIGNED_OUT;
      await renderRouter(routes, { initialUrl: "/sign-in" });

      act(() => mockSessionStore.set(SIGNED_IN));

      expect(screen.getByText("Inventory")).toBeOnTheScreen();
      expect(screen.queryByText("Sign in")).not.toBeOnTheScreen();
    });
  });

  describe("## auth-callback", () => {
    it("### is reachable while signed out", async () => {
      mockSessionStore.value = SIGNED_OUT;

      await renderRouter(routes, { initialUrl: "/auth-callback" });

      expect(screen.getByText("Finishing sign-in")).toBeOnTheScreen();
    });
  });
});
