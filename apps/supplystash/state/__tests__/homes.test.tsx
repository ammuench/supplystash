import { PostgrestError } from "@supabase/supabase-js";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCreateHome, useHome, useHomes } from "@/state/homes";
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
// Stands in for rpc("create_home", {...}).throwOnError().
const mockRpcResult = jest.fn();
const mockRpc = jest.fn((_fn: string, _args: object) => ({ throwOnError: mockRpcResult }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, args: object) => mockRpc(fn, args),
  },
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
  mockRpcResult.mockReset();
  mockRpc.mockClear();
  // `gcTime: Infinity` on both so no 5-minute gc timer outlives the test run,
  // and no retries: a single failure stands in for the 3 the app's default
  // needs.
  client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
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

describe("# useCreateHome", () => {
  const NEW_HOME_ID = "home-new";

  beforeEach(() => {
    respondWith([]);
    mockRpcResult.mockResolvedValue({ data: NEW_HOME_ID });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  // TanStack tells React about a settled mutation one tick after `mutateAsync`
  // itself settles. Waiting that tick inside `act` keeps the update from
  // landing after `act` has closed, which React reports as a warning.
  const inAct = async <T,>(run: () => Promise<T>) => {
    let value: T | undefined;
    await act(async () => {
      try {
        value = await run();
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });

    return value;
  };

  it("calls the create_home RPC with the name", async () => {
    const { result } = renderHook(() => useCreateHome(), { wrapper });

    await inAct(() => result.current.mutateAsync("Cabin"));

    expect(mockRpc).toHaveBeenCalledWith("create_home", { p_name: "Cabin" });
  });

  it("resolves with the new home's id", async () => {
    const { result } = renderHook(() => useCreateHome(), { wrapper });

    const id = await inAct(() => result.current.mutateAsync("Cabin"));

    expect(id).toBe(NEW_HOME_ID);
  });

  const loadedList = async () => {
    respondWith([row("home-1", "Flat", [{ user_id: ME, role: "member" }])]);
    const rendered = renderHook(() => ({ list: useHomes(), create: useCreateHome() }), {
      wrapper,
    });
    await waitFor(() => expect(rendered.result.current.list.isSuccess).toBe(true));

    return rendered;
  };

  // The screen opens the new home's details as soon as this resolves, and
  // `useHome` reads it from the list. The refetch here never answers, as on a
  // connection that dropped right after the create: the mutation must not
  // wait for it.
  it("adds the new home to the cached list without waiting for the refetch", async () => {
    const { result } = await loadedList();

    mockResult.mockReturnValue(new Promise(() => {}));
    const id = await inAct(() => result.current.create.mutateAsync("Cabin"));

    expect(id).toBe(NEW_HOME_ID);
    expect(client.getQueryData(queryKeys.homes())).toEqual([
      { id: NEW_HOME_ID, name: "Cabin", description: null, memberCount: 1, role: "owner" },
      { id: "home-1", name: "Flat", description: null, memberCount: 1, role: "member" },
    ]);
  });

  it("stores the name trimmed, as the server does", async () => {
    const { result } = await loadedList();

    mockResult.mockReturnValue(new Promise(() => {}));
    await inAct(() => result.current.create.mutateAsync("  Cabin  "));

    expect(client.getQueryData<{ name: string }[]>(queryKeys.homes())?.[0]?.name).toBe("Cabin");
  });

  it("replaces the cached list with the server's copy once the refetch lands", async () => {
    const { result } = await loadedList();

    const fromServer = [
      row(NEW_HOME_ID, "Cabin", [{ user_id: ME, role: "owner" }], "Set by a trigger"),
      row("home-1", "Flat", [{ user_id: ME, role: "member" }]),
    ];
    respondWith(fromServer);
    await inAct(() => result.current.create.mutateAsync("Cabin"));

    await waitFor(() =>
      expect(result.current.list.data?.[0]?.description).toBe("Set by a trigger"),
    );
  });

  // The home exists on the server either way, so it stays in the list.
  it("keeps the new home in the list when the refetch fails", async () => {
    const { result } = await loadedList();

    mockResult.mockRejectedValue(new Error("network down"));
    const id = await inAct(() => result.current.create.mutateAsync("Cabin"));

    expect(id).toBe(NEW_HOME_ID);
    expect(
      client.getQueryData<{ id: string }[]>(queryKeys.homes())?.map((home) => home.id),
    ).toEqual([NEW_HOME_ID, "home-1"]);
  });

  // Nothing to add to. The first `useHomes` fetches the whole list.
  it("leaves the cache empty when no list has been loaded", async () => {
    const { result } = renderHook(() => useCreateHome(), { wrapper });

    await inAct(() => result.current.mutateAsync("Cabin"));

    expect(client.getQueryData(queryKeys.homes())).toBeUndefined();
  });

  it("rejects with the PostgrestError itself, code intact", async () => {
    const tooLong = new PostgrestError({
      message: "violates check constraint",
      details: "",
      hint: "",
      code: "23514",
    });
    mockRpcResult.mockRejectedValue(tooLong);

    const { result } = renderHook(() => useCreateHome(), { wrapper });

    await inAct(() => expect(result.current.mutateAsync("Cabin")).rejects.toBe(tooLong));
  });

  // With the default network mode this would pause, be saved to the paused
  // queue with nothing to replay it, and never settle.
  it("sends the request while offline instead of pausing", async () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useCreateHome(), { wrapper });

    await inAct(() => result.current.mutateAsync("Cabin"));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result.current.isPaused).toBe(false);
  });
});
