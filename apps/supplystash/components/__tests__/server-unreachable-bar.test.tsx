import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ServerUnreachableBar } from "@/components/server-unreachable-bar";
import { queryKeys } from "@/state/query-keys";

// lucide-react-native ships ESM from a barrel of thousands of icon modules, and
// transforming it would slow every suite. The icon is irrelevant here.
jest.mock("lucide-react-native", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ServerOffIcon: (require("react-native") as typeof import("react-native")).View,
}));

const ITEMS = queryKeys.items("home-1");
const SAVED_COPY = "Can't reach the server — showing your last saved list.";
const EMPTY_COPY = "Can't reach the server.";

// Without initialMetrics the provider renders nothing until native reports
// insets, which never happens under jest.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let client: QueryClient;

beforeEach(() => {
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run, and no
  // retries: a single failure stands in for the 3 the app's default needs.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
});

afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

const renderBar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>
        <ServerUnreachableBar />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );

// `prefetchQuery` swallows the rejection, leaving the query in "error". Retry
// refetches with the same queryFn, so a test can choose what the retry gets.
const fetchItems = (queryFn: () => Promise<unknown>) =>
  act(() => client.prefetchQuery({ queryKey: ITEMS, queryFn }));

const networkFailure = () => Promise.reject(new TypeError("Network request failed"));

describe("# ServerUnreachableBar", () => {
  it("renders nothing while every query is reaching the server", async () => {
    renderBar();

    await fetchItems(() => Promise.resolve([]));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("## captive portal (online, requests failing)", () => {
    it("names the saved list when there is one", async () => {
      client.setQueryData(ITEMS, ["milk"]);
      renderBar();

      await fetchItems(networkFailure);

      expect(screen.getByText(SAVED_COPY)).toBeOnTheScreen();
    });

    it("drops the saved-list promise on a fresh install", async () => {
      renderBar();

      await fetchItems(networkFailure);

      expect(screen.getByText(EMPTY_COPY)).toBeOnTheScreen();
    });
  });

  it("gives way to the offline banner", async () => {
    renderBar();
    await fetchItems(networkFailure);

    act(() => onlineManager.setOnline(false));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("## Retry", () => {
    it("refetches the failing query, and goes away once it succeeds", async () => {
      const queryFn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError("Network request failed"))
        .mockResolvedValue([]);
      renderBar();
      await fetchItems(queryFn);

      fireEvent.press(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it("is disabled while the refetch is in flight", async () => {
      // With saved data the query stays in "error" while it refetches. Without
      // any, TanStack resets it to "pending" and the bar steps aside.
      client.setQueryData(ITEMS, ["milk"]);
      let resolveRetry: (rows: unknown[]) => void = () => {};
      const queryFn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError("Network request failed"))
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveRetry = resolve;
          }),
        );
      renderBar();
      await fetchItems(queryFn);

      fireEvent.press(screen.getByRole("button", { name: "Retry" }));

      expect(await screen.findByRole("button", { name: "Retrying…" })).toBeDisabled();

      await act(async () => resolveRetry([]));
    });
  });
});
