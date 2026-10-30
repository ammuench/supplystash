import { act, renderHook } from "@testing-library/react-native";

import { useSignOut } from "@/hooks/use-sign-out";
import { signOut } from "@/lib/auth";
import { countPausedMutations } from "@/lib/query-client";
import { toastError, toastSuccess } from "@/lib/toast";

jest.mock("@/lib/auth", () => ({ signOut: jest.fn() }));

jest.mock("@/lib/query-client", () => ({
  countPausedMutations: jest.fn(),
  queryClient: {},
}));

jest.mock("@/lib/toast", () => ({
  toastError: jest.fn(),
  toastSuccess: jest.fn(),
}));

const mockSignOut = jest.mocked(signOut);
const mockCountQueued = jest.mocked(countPausedMutations);

// Holds `signOut` open until `finish` is called, so a test can act while it
// is still in flight.
const holdSignOut = () => {
  let finish!: () => void;
  mockSignOut.mockReturnValue(
    new Promise((resolve) => {
      finish = () => resolve({ ok: true, data: null });
    }),
  );

  return () => finish();
};

describe("# useSignOut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ ok: true, data: null });
    mockCountQueued.mockReturnValue(0);
  });

  describe("## requestSignOut", () => {
    it("signs out straight away and toasts when nothing is queued", async () => {
      const { result } = renderHook(useSignOut);

      await act(async () => result.current.requestSignOut());

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(toastSuccess).toHaveBeenCalledWith("Signed out");
      expect(result.current.queuedToDiscard).toBe(0);
    });

    it("asks instead of signing out when changes are queued", async () => {
      mockCountQueued.mockReturnValue(2);
      const { result } = renderHook(useSignOut);

      await act(async () => result.current.requestSignOut());

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(result.current.queuedToDiscard).toBe(2);
    });

    it("toasts the error when sign-out fails", async () => {
      mockSignOut.mockResolvedValue({
        ok: false,
        error: { code: "network", message: "Network request failed" },
      });
      const { result } = renderHook(useSignOut);

      await act(async () => result.current.requestSignOut());

      expect(toastError).toHaveBeenCalledWith("Network request failed");
      expect(result.current.isSigningOut).toBe(false);
    });

    it("signs out once when pressed twice in the same frame", async () => {
      // Both presses read `isSigningOut` from the same render, so only the
      // ref guard can stop the second.
      const finish = holdSignOut();
      const { result } = renderHook(useSignOut);

      await act(async () => {
        result.current.requestSignOut();
        result.current.requestSignOut();
      });
      expect(result.current.isSigningOut).toBe(true);
      await act(async () => finish());

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(result.current.isSigningOut).toBe(false);
    });
  });

  describe("## confirmSignOut", () => {
    it("closes the dialog and signs out", async () => {
      mockCountQueued.mockReturnValue(1);
      const { result } = renderHook(useSignOut);
      await act(async () => result.current.requestSignOut());

      await act(async () => result.current.confirmSignOut());

      expect(result.current.queuedToDiscard).toBe(0);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("## cancelSignOut", () => {
    it("closes the dialog without signing out", async () => {
      mockCountQueued.mockReturnValue(1);
      const { result } = renderHook(useSignOut);
      await act(async () => result.current.requestSignOut());

      act(() => result.current.cancelSignOut());

      expect(result.current.queuedToDiscard).toBe(0);
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });
});
