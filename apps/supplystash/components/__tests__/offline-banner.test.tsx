import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/offline-banner";
import { queryKeys } from "@/state/query-keys";

// lucide-react-native ships ESM from a barrel of thousands of icon modules, and
// transforming it would slow every suite. The icon is irrelevant here.
jest.mock("lucide-react-native", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WifiOffIcon: (require("react-native") as typeof import("react-native")).View,
}));

const DAY = 24 * 60 * 60 * 1000;
const NATIVE_COPY = /changes will sync when the connection is reestablished/;
const WEB_COPY = /you can't change values until the connection is reestablished/;

// Without initialMetrics the provider renders nothing until native reports
// insets, which never happens under jest.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let client: QueryClient;

beforeEach(() => {
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
});

afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

const renderBanner = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <OfflineBanner />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );

const cacheItemsUpdated = (ago: number) =>
  client.setQueryData(queryKeys.items("home-1"), [], { updatedAt: Date.now() - ago });

describe("# OfflineBanner", () => {
  it("renders nothing while online", () => {
    renderBanner();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("goes away when the connection comes back", () => {
    onlineManager.setOnline(false);
    renderBanner();
    expect(screen.getByRole("alert")).toBeOnTheScreen();

    act(() => onlineManager.setOnline(true));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("## native", () => {
    it("says changes will sync", () => {
      onlineManager.setOnline(false);
      renderBanner();

      expect(screen.getByText(NATIVE_COPY)).toBeOnTheScreen();
    });

    it("names the age once the oldest data is over 3 days old", () => {
      cacheItemsUpdated(5 * DAY);
      onlineManager.setOnline(false);
      renderBanner();

      expect(screen.getByText(/Last updated 5 days ago\.$/)).toBeOnTheScreen();
    });

    it("leaves the age off for data 3 days old or newer", () => {
      cacheItemsUpdated(2 * DAY);
      onlineManager.setOnline(false);
      renderBanner();

      expect(screen.queryByText(/Last updated/)).toBeNull();
    });
  });

  describe("## web", () => {
    // `replaceProperty` mutates the real module object, so without an explicit
    // restore the "web" value leaks into every block declared after this one.
    let platform: ReturnType<typeof jest.replaceProperty>;

    beforeEach(() => {
      platform = jest.replaceProperty(Platform, "OS", "web");
    });

    afterEach(() => {
      platform.restore();
    });

    it("says values can't change, with no age", () => {
      cacheItemsUpdated(5 * DAY);
      onlineManager.setOnline(false);
      renderBanner();

      expect(screen.getByText(WEB_COPY)).toBeOnTheScreen();
      expect(screen.queryByText(/Last updated/)).toBeNull();
    });
  });
});
