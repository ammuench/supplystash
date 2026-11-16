import { useIsRestoring } from "@tanstack/react-query";
import { act, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import { SplashScreenController } from "@/components/splash-screen-controller";
import { useIsQueryCacheClaimed } from "@/hooks/use-is-query-cache-claimed";
import { useIsQueryCacheRestored } from "@/lib/query-cache-restore";
import { restoreThemePreference } from "@/lib/theme-preference";
import { useSession } from "@/state/session";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn() }));
jest.mock("@/lib/theme-preference", () => ({ restoreThemePreference: jest.fn() }));
jest.mock("@/state/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/query-cache-restore", () => ({ useIsQueryCacheRestored: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useIsRestoring: jest.fn() }));
jest.mock("@/hooks/use-is-query-cache-claimed", () => ({ useIsQueryCacheClaimed: jest.fn() }));

const mockedHideAsync = jest.mocked(SplashScreen.hideAsync);
const mockedRestore = jest.mocked(restoreThemePreference);
const mockedUseSession = jest.mocked(useSession) as jest.Mock;
const mockedIsQueryCacheRestored = jest.mocked(useIsQueryCacheRestored);
const mockedIsRestoring = jest.mocked(useIsRestoring);
const mockedIsQueryCacheClaimed = jest.mocked(useIsQueryCacheClaimed);

const SESSION = { user: { id: "user-1" } };

// Hands the test the resolver so it controls exactly when the theme restore
// finishes, independently of the session.
const deferRestore = () => {
  let resolve!: () => void;
  mockedRestore.mockReturnValue(
    new Promise<void>((r) => {
      resolve = r;
    }),
  );
  return () => act(async () => resolve());
};

beforeEach(() => {
  jest.clearAllMocks();
  // Both caches restored unless a test says otherwise, so the theme and
  // session cases below test only those two signals.
  mockedIsQueryCacheRestored.mockReturnValue(true);
  mockedIsRestoring.mockReturnValue(false);
  mockedIsQueryCacheClaimed.mockReturnValue(true);
});

describe("# SplashScreenController", () => {
  it("## restores the theme once on mount", () => {
    deferRestore();
    mockedUseSession.mockReturnValue({ isLoading: true });

    const { rerender } = render(<SplashScreenController />);
    rerender(<SplashScreenController />);

    expect(mockedRestore).toHaveBeenCalledTimes(1);
  });

  describe("## holds the splash", () => {
    it("### while the theme is restoring", () => {
      deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });

      render(<SplashScreenController />);

      expect(mockedHideAsync).not.toHaveBeenCalled();
    });

    it("### while the session is loading", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: true });

      render(<SplashScreenController />);
      await finishRestore();

      expect(mockedHideAsync).not.toHaveBeenCalled();
    });

    it("### while the read cache is restoring", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });
      mockedIsQueryCacheRestored.mockReturnValue(false);

      render(<SplashScreenController />);
      await finishRestore();

      expect(mockedHideAsync).not.toHaveBeenCalled();
    });

    it("### while the paused-mutation queue is restoring", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });
      mockedIsRestoring.mockReturnValue(true);

      render(<SplashScreenController />);
      await finishRestore();

      expect(mockedHideAsync).not.toHaveBeenCalled();
    });

    it("### while the read cache is being claimed for the saved user", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ session: SESSION, isLoading: false });
      mockedIsQueryCacheClaimed.mockReturnValue(false);

      render(<SplashScreenController />);
      await finishRestore();

      expect(mockedIsQueryCacheClaimed).toHaveBeenCalledWith("user-1");
      expect(mockedHideAsync).not.toHaveBeenCalled();
    });
  });

  describe("## hides the splash", () => {
    it("### once the session loads after the theme", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: true });

      const { rerender } = render(<SplashScreenController />);
      await finishRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });
      rerender(<SplashScreenController />);

      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });

    it("### once the theme restores after the session", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });

      render(<SplashScreenController />);
      await finishRestore();

      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });

    it("### once the read cache restores last", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });
      mockedIsQueryCacheRestored.mockReturnValue(false);

      const { rerender } = render(<SplashScreenController />);
      await finishRestore();
      mockedIsQueryCacheRestored.mockReturnValue(true);
      rerender(<SplashScreenController />);

      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });

    it("### signed out, without waiting for a claim", async () => {
      // There is no user to claim for, and sign-in shows no cached rows.
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ session: null, isLoading: false });
      mockedIsQueryCacheClaimed.mockReturnValue(false);

      render(<SplashScreenController />);
      await finishRestore();

      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });

    it("### only once across later re-renders", async () => {
      const finishRestore = deferRestore();
      mockedUseSession.mockReturnValue({ isLoading: false });

      const { rerender } = render(<SplashScreenController />);
      await finishRestore();
      rerender(<SplashScreenController />);

      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });
  });
});
