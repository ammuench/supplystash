import { act, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import { SplashScreenController } from "@/components/splash-screen-controller";
import { restoreThemePreference } from "@/lib/theme-preference";
import { useSession } from "@/state/session";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn() }));
jest.mock("@/lib/theme-preference", () => ({ restoreThemePreference: jest.fn() }));
jest.mock("@/state/session", () => ({ useSession: jest.fn() }));

const mockedHideAsync = jest.mocked(SplashScreen.hideAsync);
const mockedRestore = jest.mocked(restoreThemePreference);
const mockedUseSession = jest.mocked(useSession) as jest.Mock;

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
