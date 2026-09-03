import type { Session, User } from "@supabase/supabase-js";

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { supabase } from "@/lib/supabase";
import { SessionProvider, useSession } from "@/state/session";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;

const USER = { id: "00000000-0000-0000-0000-000000000000" } as User;
const SESSION = { access_token: "header.payload.signature", user: USER } as Session;

// Captured so a test can push an auth event the way supabase-js would.
let emit: (event: string, session: Session | null) => void;

beforeEach(() => {
  jest.clearAllMocks();
  auth.onAuthStateChange.mockImplementation(((callback: typeof emit) => {
    emit = callback;

    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }) as never);
  auth.getSession.mockResolvedValue({ data: { session: null } } as never);
});

const renderSession = () => renderHook(() => useSession(), { wrapper: SessionProvider });

describe("# SessionProvider", () => {
  it("starts loading, so the gate holds the splash instead of flashing sign-in", async () => {
    const { result } = renderSession();

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("restores a persisted session on cold start", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);

    const { result } = renderSession();

    await waitFor(() => expect(result.current.session).toBe(SESSION));
    expect(result.current.user).toBe(USER);
  });

  it("adopts a sign-in event without waiting for another storage read", async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => emit("SIGNED_IN", SESSION));

    expect(result.current.session).toBe(SESSION);
    expect(result.current.user).toBe(USER);
  });

  it("clears the user on sign-out, so no stale identity survives", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("throws when used outside the provider, rather than reporting a signed-out user", () => {
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });
});
