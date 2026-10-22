import type { Session, User } from "@supabase/supabase-js";

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { consumeUserInitiatedSignOut } from "@/lib/auth";
import { wipeAppQueryCache } from "@/lib/query-cache-wipe";
import { countPausedMutations, queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { toastInfo } from "@/lib/toast";
import {
  SESSION_EXPIRED_MESSAGE,
  SessionProvider,
  sessionExpiredMessage,
  useSession,
} from "@/state/session";

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

jest.mock("@/lib/query-client", () => ({
  countPausedMutations: jest.fn(),
  queryClient: { clear: jest.fn() },
}));

// The boot read-cache pass, held open until a test settles it. A getter so
// each test gets the fresh promise `beforeEach` makes.
const mockBootPass = { promise: new Promise<void>(() => {}), settle: () => {} };
jest.mock("@/lib/query-cache-restore", () => ({
  get queryCacheRestored() {
    return mockBootPass.promise;
  },
}));

jest.mock("@/lib/query-cache-wipe", () => ({
  wipeAppQueryCache: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  consumeUserInitiatedSignOut: jest.fn(),
}));

jest.mock("@/lib/toast", () => ({
  toastInfo: jest.fn(),
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const clearCache = queryClient.clear as jest.Mock;
const wipeDisk = wipeAppQueryCache as jest.Mock;
const countQueued = countPausedMutations as jest.Mock;
const consumeSignOutIntent = consumeUserInitiatedSignOut as jest.Mock;
const showInfoToast = toastInfo as jest.Mock;

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
  consumeSignOutIntent.mockReturnValue(false);
  countQueued.mockReturnValue(0);
  mockBootPass.promise = new Promise<void>((resolve) => {
    mockBootPass.settle = resolve;
  });
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

  it("does not let a slow storage read overwrite a sign-in that landed first", async () => {
    // Held open so the auth event provably wins the race the `settled` guard
    // exists to arbitrate; resolving the mock up front would not test it.
    let releaseStorage: (value: unknown) => void = () => {};
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        releaseStorage = resolve;
      }) as never,
    );

    const { result } = renderSession();

    act(() => emit("SIGNED_IN", SESSION));
    expect(result.current.session).toBe(SESSION);

    await act(async () => {
      releaseStorage({ data: { session: null } });
    });

    expect(result.current.session).toBe(SESSION);
    expect(result.current.isLoading).toBe(false);
  });

  it("settles signed-out when the session cannot be decrypted, rather than hanging the splash", async () => {
    auth.getSession.mockRejectedValue(new Error("Could not decrypt session"));

    const { result } = renderSession();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("clears the user on sign-out, so no stale identity survives", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("clears the query cache on sign-out, so the next account reads no cached rows", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it("clears the cache again once the boot pass settles, so its late writes do not survive sign-out", async () => {
    // A refresh token rejected at launch signs out while the boot pass is
    // still writing the old account's rows into memory.
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));
    expect(clearCache).toHaveBeenCalledTimes(1);

    await act(async () => mockBootPass.settle());

    expect(clearCache).toHaveBeenCalledTimes(2);
  });

  it("wipes the disk cache on sign-out without waiting for the boot pass", async () => {
    // The pass is held open here: the next account's boot pass would restore
    // whatever is still on disk, so the wipe should not sit behind this one.
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));
    expect(wipeDisk).toHaveBeenCalledTimes(1);

    await act(async () => mockBootPass.settle());

    expect(wipeDisk).toHaveBeenCalledTimes(1);
  });

  it("announces an involuntary sign-out, so an expired token does not read as a crash", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(showInfoToast).toHaveBeenCalledWith(SESSION_EXPIRED_MESSAGE);
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it("reports queued changes an involuntary sign-out discarded, counted before the clear", async () => {
    // Nobody was asked first, so the loss must not be silent.
    countQueued.mockImplementation(() => (clearCache.mock.calls.length === 0 ? 2 : 0));
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(showInfoToast).toHaveBeenCalledWith(sessionExpiredMessage(2));
  });

  it("does not report queued changes on a user-initiated sign-out, which confirmed the loss already", async () => {
    consumeSignOutIntent.mockReturnValue(true);
    countQueued.mockReturnValue(2);
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(showInfoToast).not.toHaveBeenCalled();
  });

  it("stays quiet on a user-initiated sign-out, which already toasts its own message", async () => {
    consumeSignOutIntent.mockReturnValue(true);
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(showInfoToast).not.toHaveBeenCalled();
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it("re-reads the sign-out intent per event, so an expiry after a voluntary sign-out still announces itself", async () => {
    consumeSignOutIntent.mockReturnValueOnce(true).mockReturnValue(false);
    auth.getSession.mockResolvedValue({ data: { session: SESSION } } as never);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.session).toBe(SESSION));

    act(() => emit("SIGNED_OUT", null));

    expect(showInfoToast).not.toHaveBeenCalled();

    act(() => emit("SIGNED_IN", SESSION));
    act(() => emit("SIGNED_OUT", null));

    expect(showInfoToast).toHaveBeenCalledWith(SESSION_EXPIRED_MESSAGE);
  });

  it("leaves the query cache and disk alone on sign-in", async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => emit("SIGNED_IN", SESSION));
    await act(async () => mockBootPass.settle());

    expect(result.current.session).toBe(SESSION);
    expect(clearCache).not.toHaveBeenCalled();
    expect(wipeDisk).not.toHaveBeenCalled();
  });

  it("throws when used outside the provider, rather than reporting a signed-out user", () => {
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });
});

describe("# sessionExpiredMessage", () => {
  it("is the plain expiry notice when nothing was discarded", () => {
    expect(sessionExpiredMessage(0)).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("names a single discarded change", () => {
    expect(sessionExpiredMessage(1)).toBe(
      "Your session expired, and 1 unsynced change was discarded — please sign in again.",
    );
  });

  it("names several discarded changes", () => {
    expect(sessionExpiredMessage(3)).toBe(
      "Your session expired, and 3 unsynced changes were discarded — please sign in again.",
    );
  });
});
