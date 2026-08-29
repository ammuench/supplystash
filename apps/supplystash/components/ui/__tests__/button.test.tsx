import { render, screen, userEvent } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

// Smoke test for the whole jest-expo + uniwind + rn-primitives transform chain.
// If this renders, the test runner is wired correctly for every other component.
describe("Button", () => {
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
});
