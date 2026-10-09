import { render, screen, userEvent } from "@testing-library/react-native";

import { ThemePicker } from "@/components/theme-picker";
import { useThemePreference } from "@/lib/theme-preference";

// The hook has its own suite (lib/__tests__/theme-preference.test.ts); this one
// only checks the picker reflects it and writes back through it.
jest.mock("@/lib/theme-preference", () => ({
  ...jest.requireActual("@/lib/theme-preference"),
  useThemePreference: jest.fn(),
}));

const mockedUseThemePreference = jest.mocked(useThemePreference);
const setPreference = jest.fn();

beforeEach(() => {
  setPreference.mockReset();
  mockedUseThemePreference.mockReturnValue({ preference: "dark", setPreference });
});

describe("# ThemePicker", () => {
  it("## marks the current preference", () => {
    render(<ThemePicker />);

    expect(screen.getByRole("tab", { name: "Dark" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "System" })).not.toBeSelected();
  });

  it("## pressing an option calls setPreference", async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);

    await user.press(screen.getByText("Light"));

    expect(setPreference).toHaveBeenCalledWith("light");
  });
});
