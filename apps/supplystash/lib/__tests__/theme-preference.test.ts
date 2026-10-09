import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { Uniwind, useUniwind } from "uniwind";

import { restoreThemePreference, useThemePreference } from "@/lib/theme-preference";

// Uniwind's runtime has no compiled stylesheet under Jest, so both the hook and
// the setter are stubbed: this suite asserts what gets applied and stored.
jest.mock("uniwind", () => ({
  Uniwind: { setTheme: jest.fn() },
  useUniwind: jest.fn(),
}));

const mockedSetTheme = jest.mocked(Uniwind.setTheme) as jest.Mock;
const mockedUseUniwind = jest.mocked(useUniwind) as jest.Mock;

const KEY = "theme-preference";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("# restoreThemePreference", () => {
  describe("## read", () => {
    it("### applies the stored preference", async () => {
      await AsyncStorage.setItem(KEY, "dark");

      await restoreThemePreference();

      expect(mockedSetTheme).toHaveBeenCalledWith("dark");
    });

    it("### follows the system when nothing is stored", async () => {
      await restoreThemePreference();

      expect(mockedSetTheme).toHaveBeenCalledWith("system");
    });

    it("### follows the system when the stored value is unknown", async () => {
      await AsyncStorage.setItem(KEY, "sepia");

      await restoreThemePreference();

      expect(mockedSetTheme).toHaveBeenCalledWith("system");
    });
  });

  describe("## storage failure", () => {
    it("### follows the system and resolves when the read throws", async () => {
      jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));

      await expect(restoreThemePreference()).resolves.toBeUndefined();
      expect(mockedSetTheme).toHaveBeenCalledWith("system");
    });
  });
});

describe("# useThemePreference", () => {
  describe("## preference", () => {
    it("### is system while Uniwind follows the OS", () => {
      mockedUseUniwind.mockReturnValue({ theme: "dark", hasAdaptiveThemes: true });

      const { result } = renderHook(() => useThemePreference());

      expect(result.current.preference).toBe("system");
    });

    it("### is the forced theme otherwise", () => {
      mockedUseUniwind.mockReturnValue({ theme: "light", hasAdaptiveThemes: false });

      const { result } = renderHook(() => useThemePreference());

      expect(result.current.preference).toBe("light");
    });
  });

  describe("## write", () => {
    it("### applies and stores the new preference", async () => {
      mockedUseUniwind.mockReturnValue({ theme: "dark", hasAdaptiveThemes: true });
      const { result } = renderHook(() => useThemePreference());

      await act(() => result.current.setPreference("light"));

      expect(mockedSetTheme).toHaveBeenCalledWith("light");
      expect(await AsyncStorage.getItem(KEY)).toBe("light");
    });
  });

  describe("## storage failure", () => {
    it("### still applies the theme when the write throws", async () => {
      mockedUseUniwind.mockReturnValue({ theme: "dark", hasAdaptiveThemes: true });
      jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk"));
      const { result } = renderHook(() => useThemePreference());

      await expect(act(() => result.current.setPreference("dark"))).resolves.toBeUndefined();
      expect(mockedSetTheme).toHaveBeenCalledWith("dark");
    });
  });
});
