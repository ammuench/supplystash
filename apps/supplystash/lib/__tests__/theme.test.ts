import { renderHook } from "@testing-library/react-native";
import { DarkTheme, DefaultTheme } from "expo-router/react-navigation";
import { useCSSVariable, useUniwind } from "uniwind";

import { useNavTheme } from "@/lib/theme";

// Uniwind's runtime has no compiled stylesheet under Jest, so both hooks are
// stubbed: this suite only asserts the CSS-variable -> nav-color mapping.
jest.mock("uniwind", () => ({
  useCSSVariable: jest.fn(),
  useUniwind: jest.fn(),
}));

const mockedUseCSSVariable = jest.mocked(useCSSVariable) as jest.Mock;
const mockedUseUniwind = jest.mocked(useUniwind) as jest.Mock;

// Same order as the names passed to useCSSVariable in useNavTheme.
const CSS_VALUES = ["#background", "#border", "#card", "#destructive", "#primary", "#foreground"];

describe("# useNavTheme", () => {
  beforeEach(() => {
    mockedUseUniwind.mockReturnValue({ theme: "light" });
    mockedUseCSSVariable.mockReturnValue(CSS_VALUES);
  });

  it("## maps CSS variables onto nav colors", () => {
    const { result } = renderHook(() => useNavTheme());

    expect(result.current.colors).toEqual({
      background: "#background",
      border: "#border",
      card: "#card",
      notification: "#destructive",
      primary: "#primary",
      text: "#foreground",
    });
  });

  it("## falls back to the base theme when a variable is missing", () => {
    mockedUseCSSVariable.mockReturnValue([undefined, 1, ...CSS_VALUES.slice(2)]);

    const { result } = renderHook(() => useNavTheme());

    expect(result.current.colors.background).toBe(DefaultTheme.colors.background);
    expect(result.current.colors.border).toBe(DefaultTheme.colors.border);
    expect(result.current.colors.card).toBe("#card");
  });

  it("## uses DarkTheme as the base in dark mode", () => {
    mockedUseUniwind.mockReturnValue({ theme: "dark" });

    const { result } = renderHook(() => useNavTheme());

    expect(result.current.dark).toBe(true);
    expect(result.current.fonts).toBe(DarkTheme.fonts);
  });
});
