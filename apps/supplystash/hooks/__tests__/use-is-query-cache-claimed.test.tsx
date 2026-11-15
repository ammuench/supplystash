import { act, renderHook } from "@testing-library/react-native";

import {
  resetQueryCacheClaimForTests,
  useIsQueryCacheClaimed,
} from "@/hooks/use-is-query-cache-claimed";
import { claimAppQueryCache } from "@/lib/query-cache-owner";

jest.mock("@/lib/query-cache-owner", () => ({ claimAppQueryCache: jest.fn() }));

const claimCache = jest.mocked(claimAppQueryCache);

const ACCOUNT_A = "aaaaaaaa-0000-0000-0000-000000000000";
const ACCOUNT_B = "bbbbbbbb-0000-0000-0000-000000000000";

// Holds the next claim open until the test releases it.
const holdClaim = () => {
  let release!: () => void;
  claimCache.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  return () => act(async () => release());
};

const renderClaim = (userId: string | undefined) =>
  renderHook(({ id }: { id: string | undefined }) => useIsQueryCacheClaimed(id), {
    initialProps: { id: userId },
  });

beforeEach(() => {
  jest.clearAllMocks();
  resetQueryCacheClaimForTests();
  claimCache.mockResolvedValue(undefined);
});

describe("# useIsQueryCacheClaimed", () => {
  describe("## signed in", () => {
    it("is false until the claim for that user settles", async () => {
      const releaseClaim = holdClaim();

      const { result } = renderClaim(ACCOUNT_A);
      await act(async () => {});

      expect(claimCache).toHaveBeenCalledWith(ACCOUNT_A);
      expect(result.current).toBe(false);

      await releaseClaim();

      expect(result.current).toBe(true);
    });

    it("does not claim again on a re-render for the same user", async () => {
      // A token refresh hands over a new session for the same user.
      const { rerender } = renderClaim(ACCOUNT_A);
      await act(async () => {});

      rerender({ id: ACCOUNT_A });
      await act(async () => {});

      expect(claimCache).toHaveBeenCalledTimes(1);
    });
  });

  describe("## signed out", () => {
    it("is false and claims nothing", async () => {
      const { result } = renderClaim(undefined);
      await act(async () => {});

      expect(result.current).toBe(false);
      expect(claimCache).not.toHaveBeenCalled();
    });

    it("drops the claim at once on sign-out, and claims again when the user returns", async () => {
      const { result, rerender } = renderClaim(ACCOUNT_A);
      await act(async () => {});
      expect(result.current).toBe(true);

      rerender({ id: undefined });
      expect(result.current).toBe(false);

      rerender({ id: ACCOUNT_A });
      expect(result.current).toBe(false);
      await act(async () => {});

      expect(result.current).toBe(true);
      expect(claimCache).toHaveBeenCalledTimes(2);
    });
  });

  describe("## switching user mid-claim", () => {
    it("never reports the first user's claim for the second", async () => {
      const releaseFirst = holdClaim();
      const { result, rerender } = renderClaim(ACCOUNT_A);

      rerender({ id: undefined });
      rerender({ id: ACCOUNT_B });
      await releaseFirst();

      expect(claimCache).toHaveBeenLastCalledWith(ACCOUNT_B);
      expect(result.current).toBe(true);
    });

    it("runs the second claim only after the first finishes", async () => {
      // A claim that wipes must finish before the next one reads the owner.
      const releaseFirst = holdClaim();
      const { rerender } = renderClaim(ACCOUNT_A);

      rerender({ id: ACCOUNT_B });
      await act(async () => {});
      expect(claimCache).toHaveBeenCalledTimes(1);

      await releaseFirst();

      expect(claimCache).toHaveBeenCalledTimes(2);
      expect(claimCache).toHaveBeenLastCalledWith(ACCOUNT_B);
    });

    it("stays false while a sign-out lands mid-claim", async () => {
      const releaseClaim = holdClaim();
      const { result, rerender } = renderClaim(ACCOUNT_A);

      rerender({ id: undefined });
      await releaseClaim();

      expect(result.current).toBe(false);
    });
  });
});
