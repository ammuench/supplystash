import { render, screen, userEvent } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

// Smoke test for the whole jest-expo + uniwind + rn-primitives transform chain.
// If this renders, the test runner is wired correctly for every other component.
describe("# Button", () => {
  it("renders its label", () => {
    render(
      <Button>
        <Text>Add to stash</Text>
      </Button>,
    );

    expect(screen.getByText("Add to stash")).toBeOnTheScreen();
  });

  it("calls onPress when tapped", async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();

    render(
      <Button onPress={onPress}>
        <Text>Add to stash</Text>
      </Button>,
    );
    await user.press(screen.getByText("Add to stash"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe("## size icon", () => {
    it("is named by its aria-label", () => {
      render(
        <Button size="icon" aria-label="Scan barcode">
          <Text>+</Text>
        </Button>,
      );

      expect(screen.getByRole("button", { name: "Scan barcode" })).toBeOnTheScreen();
    });

    it("needs an aria-label to type-check", () => {
      // Checked by `tsc`, not jest: the render only keeps the line in use.
      render(
        // @ts-expect-error -- an icon-only button has nothing to read aloud
        <Button size="icon">
          <Text>+</Text>
        </Button>,
      );
    });
  });
});
