import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useOldestPersistedUpdatedAt } from "@/hooks/use-oldest-persisted-updated-at";
import { queryKeys } from "@/state/query-keys";

const HOME = "home-1";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-08-29T12:00:00Z");

let client: QueryClient;

beforeEach(() => {
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
});

afterEach(() => {
  client.clear();
});

const renderOldest = () =>
  renderHook(() => useOldestPersistedUpdatedAt(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

describe("# useOldestPersistedUpdatedAt", () => {
  it("is null when nothing is cached", () => {
    const { result } = renderOldest();

    expect(result.current).toBeNull();
  });

  it("is the oldest update across the persisted roots", () => {
    client.setQueryData(queryKeys.items(HOME), [], { updatedAt: NOW - DAY });
    client.setQueryData(queryKeys.shoppingList(HOME), [], { updatedAt: NOW - 5 * DAY });
    client.setQueryData(queryKeys.homes(), [], { updatedAt: NOW });

    const { result } = renderOldest();

    expect(result.current).toBe(NOW - 5 * DAY);
  });

  it("ignores roots that are not persisted", () => {
    client.setQueryData(queryKeys.items(HOME), [], { updatedAt: NOW });
    // Memory-only, so it is always as fresh as the session.
    client.setQueryData(queryKeys.itemHistory(HOME, "item-1"), [], { updatedAt: NOW - 9 * DAY });

    const { result } = renderOldest();

    expect(result.current).toBe(NOW);
  });

  it("ignores queries that have never had data", () => {
    client.setQueryData(queryKeys.items(HOME), [], { updatedAt: NOW });
    // Built but never fetched, like a query that is still loading.
    client.getQueryCache().build(client, { queryKey: queryKeys.categories(HOME) });

    const { result } = renderOldest();

    expect(result.current).toBe(NOW);
  });

  it("moves forward when the oldest query is refetched", () => {
    client.setQueryData(queryKeys.items(HOME), [], { updatedAt: NOW - DAY });
    client.setQueryData(queryKeys.shoppingList(HOME), [], { updatedAt: NOW - 5 * DAY });
    const { result } = renderOldest();

    act(() => {
      client.setQueryData(queryKeys.shoppingList(HOME), [], { updatedAt: NOW });
    });

    expect(result.current).toBe(NOW - DAY);
  });
});
