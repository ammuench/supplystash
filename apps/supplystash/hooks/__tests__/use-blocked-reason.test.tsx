import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

import type { BlockedAction } from "@/lib/blocked-reason";

import { useBlockedReason } from "@/hooks/use-blocked-reason";
import { queryKeys } from "@/state/query-keys";

const HOME = "home-1";

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

const renderBlockedReason = (action: BlockedAction) =>
  renderHook(() => useBlockedReason(action), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

// `prefetchQuery` swallows the rejection, leaving the query in "error".
const failItemsFetch = () =>
  act(() =>
    client.prefetchQuery({
      queryKey: queryKeys.items(HOME),
      queryFn: () => Promise.reject(new TypeError("Network request failed")),
    }),
  );

describe("# useBlockedReason", () => {
  it("is not blocked when connected", () => {
    const { result } = renderBlockedReason("ledger-write");

    expect(result.current).toEqual({ blocked: false });
  });

  it("re-renders when the connection drops and comes back", () => {
    const { result } = renderBlockedReason("ledger-write");

    act(() => onlineManager.setOnline(false));
    expect(result.current).toEqual({ blocked: true, reason: expect.stringMatching(/offline/) });

    act(() => onlineManager.setOnline(true));
    expect(result.current).toEqual({ blocked: false });
  });

  it("blocks once the server stops answering", async () => {
    const { result } = renderBlockedReason("ledger-write");

    await failItemsFetch();

    expect(result.current).toEqual({
      blocked: true,
      reason: expect.stringMatching(/server unreachable/),
    });
  });

  describe("## check-off offline", () => {
    it("is not blocked on native", () => {
      const { result } = renderBlockedReason("check-off");

      act(() => onlineManager.setOnline(false));

      expect(result.current).toEqual({ blocked: false });
    });

    describe("### web", () => {
      // `replaceProperty` mutates the real module object, so without an
      // explicit restore the "web" value leaks into every later block.
      let platform: ReturnType<typeof jest.replaceProperty>;

      beforeEach(() => {
        platform = jest.replaceProperty(Platform, "OS", "web");
      });

      afterEach(() => {
        platform.restore();
      });

      it("is blocked", () => {
        const { result } = renderBlockedReason("check-off");

        act(() => onlineManager.setOnline(false));

        expect(result.current).toEqual({
          blocked: true,
          reason: expect.stringMatching(/client offline/),
        });
      });
    });
  });
});
