import { render, screen, userEvent } from "@testing-library/react-native";

import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";

// The pressed wash itself is a style class and is checked on a device. These
// tests cover what the wrapper must not break: it is still a `Pressable`.
describe("# PressableSurface", () => {
  it("renders its children", () => {
    render(
      <PressableSurface>
        <Text>Lake House</Text>
      </PressableSurface>,
    );

    expect(screen.getByText("Lake House")).toBeOnTheScreen();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(
      <PressableSurface role="button" aria-label="Open" onPress={onPress}>
        <Text>Lake House</Text>
      </PressableSurface>,
    );

    await user.press(screen.getByRole("button", { name: "Open" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(
      <PressableSurface role="button" aria-label="Open" disabled onPress={onPress}>
        <Text>Lake House</Text>
      </PressableSurface>,
    );

    await user.press(screen.getByRole("button", { name: "Open" }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
