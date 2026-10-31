import { PostgrestError } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";
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
});

const renderUnreachable = () =>
  renderHook(() => useIsServerUnreachable(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

// `prefetchQuery` swallows the rejection, leaving the query in "error".
const fail = (queryKey: QueryKey, error: unknown) =>
  act(() => client.prefetchQuery({ queryKey, queryFn: () => Promise.reject(error) }));

const succeed = (queryKey: QueryKey) =>
  act(() => client.prefetchQuery({ queryKey, queryFn: () => Promise.resolve([]) }));

describe("# useIsServerUnreachable", () => {
  it("is false when nothing has failed", async () => {
    const { result } = renderUnreachable();

    await succeed(queryKeys.items(HOME));

    expect(result.current).toBe(false);
  });

  describe("## captive portal (online, requests failing)", () => {
    it("is true when a persisted query's fetch throws", async () => {
      const { result } = renderUnreachable();

      await fail(queryKeys.items(HOME), new TypeError("Network request failed"));

      expect(result.current).toBe(true);
    });

    it("is true when the portal answers with its own page", async () => {
      const { result } = renderUnreachable();

      await fail(
        queryKeys.shoppingList(HOME),
        new PostgrestError({ message: "<html>", details: "", hint: "", code: "" }),
      );

      expect(result.current).toBe(true);
    });
  });

  it("is false when the server answers with a refusal", async () => {
    const { result } = renderUnreachable();

    await fail(
      queryKeys.items(HOME),
      new PostgrestError({ message: "", details: "", hint: "", code: "42501" }),
    );

    expect(result.current).toBe(false);
  });

  it("ignores roots that are not persisted", async () => {
    const { result } = renderUnreachable();

    await fail(queryKeys.itemHistory(HOME, "item-1"), new TypeError("Network request failed"));

    expect(result.current).toBe(false);
  });

  it("clears once the failing query fetches again", async () => {
    const { result } = renderUnreachable();
    await fail(queryKeys.items(HOME), new TypeError("Network request failed"));
    expect(result.current).toBe(true);

    await succeed(queryKeys.items(HOME));

    expect(result.current).toBe(false);
  });
});
