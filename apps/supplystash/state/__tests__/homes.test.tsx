import { PostgrestError } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { useHome, useHomes } from "@/state/homes";
import { queryKeys } from "@/state/query-keys";

const ME = "user-me";
const OTHER = "user-other";

// The signed-in user, swapped per test. `null` is signed out.
let mockUser: { id: string } | null = { id: ME };
jest.mock("@/state/session", () => ({
  useSession: () => ({ user: mockUser }),
}));

// Stands in for the supabase-js query chain the hook builds:
// from("homes").select(...).order("name").throwOnError(). Each test sets what
// the final call resolves or rejects with.
const mockResult = jest.fn();
const mockOrder = jest.fn((_column: string) => ({ throwOnError: mockResult }));
const mockSelect = jest.fn(() => ({ order: mockOrder }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
jest.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

// A row as PostgREST returns it: a home with its embedded membership rows.
const row = (
  id: string,
  name: string,
  memberships: { user_id: string; role: string }[],
  description: string | null = null,
) => ({ id, name, description, user_homes: memberships });

const respondWith = (rows: ReturnType<typeof row>[]) =>
  mockResult.mockResolvedValue({ data: rows });

let client: QueryClient;

beforeEach(() => {
  mockUser = { id: ME };
  mockResult.mockReset();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockOrder.mockClear();
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run, and no
  // retries: a single failure stands in for the 3 the app's default needs.
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
});

afterEach(() => {
  client.clear();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("# useHomes", () => {
  describe("## loaded", () => {
    it("returns each home with its member count and the user's own role", async () => {
      respondWith([
        row(
          "home-1",
          "Cabin",
          [
            { user_id: OTHER, role: "owner" },
            { user_id: ME, role: "member" },
          ],
          "Up north",
        ),
        row("home-2", "Flat", [{ user_id: ME, role: "owner" }]),
      ]);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        { id: "home-1", name: "Cabin", description: "Up north", memberCount: 2, role: "member" },
        { id: "home-2", name: "Flat", description: null, memberCount: 1, role: "owner" },
      ]);
    });

    it("reads the homes table, sorted by name", async () => {
      respondWith([]);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFrom).toHaveBeenCalledWith("homes");
      expect(mockOrder).toHaveBeenCalledWith("name");
    });

    it("stores the result under the homes key", async () => {
      respondWith([row("home-1", "Cabin", [{ user_id: ME, role: "owner" }])]);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(client.getQueryData(queryKeys.homes())).toEqual(result.current.data);
    });

    it("is an empty list for a user with no homes", async () => {
      respondWith([]);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });
  });

  describe("## role fallback", () => {
    // Neither case should happen: RLS only returns homes the user belongs to,
    // and a CHECK constraint limits the role. If one does, the user must not
    // be shown controls for a role they may not hold.
    it("treats a role the app does not know as viewer", async () => {
      respondWith([row("home-1", "Cabin", [{ user_id: ME, role: "superuser" }])]);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0]?.role).toBe("viewer");
    });

    it("treats a home with no membership row for the user as viewer", async () => {
      respondWith([row("home-1", "Cabin", [{ user_id: OTHER, role: "owner" }])]);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0]?.role).toBe("viewer");
    });
  });

  describe("## error", () => {
    it("surfaces the PostgrestError itself, code intact", async () => {
      const denied = new PostgrestError({
        message: "permission denied",
        details: "",
        hint: "",
        code: "42501",
      });
      mockResult.mockRejectedValue(denied);

      const { result } = renderHook(() => useHomes(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBe(denied);
    });
  });

  describe("## signed out", () => {
    it("does not fetch", () => {
      mockUser = null;

      const { result } = renderHook(() => useHomes(), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});

describe("# useHome", () => {
  beforeEach(() => {
    respondWith([
      row("home-1", "Cabin", [{ user_id: ME, role: "owner" }]),
      row("home-2", "Flat", [{ user_id: ME, role: "member" }]),
    ]);
  });

  it("returns the home with that id", async () => {
    const { result } = renderHook(() => useHome("home-2"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      id: "home-2",
      name: "Flat",
      description: null,
      memberCount: 1,
      role: "member",
    });
  });

  it("is null for an id that is not in the user's homes", async () => {
    const { result } = renderHook(() => useHome("home-gone"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it("shares one request with useHomes", async () => {
    const { result } = renderHook(() => ({ list: useHomes(), one: useHome("home-1") }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.one.isSuccess).toBe(true));

    expect(result.current.list.data).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
