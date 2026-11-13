import { render, screen, userEvent } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import { HomeCard } from "@/components/home-card";

// lucide-react-native ships ESM from a barrel of thousands of icon modules, and
// transforming it would slow every suite. The icon is irrelevant here.
jest.mock("lucide-react-native", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native") as typeof import("react-native");

  return { HouseIcon: View };
});

const home: Home = {
  id: "home-1",
  name: "Lake House",
  description: null,
  memberCount: 3,
  role: "admin",
};

describe("# HomeCard", () => {
  it("shows the home's name, member count and the user's role", () => {
    render(<HomeCard home={home} />);

    expect(screen.getByText("Lake House")).toBeOnTheScreen();
    expect(screen.getByText(/Members: 3/)).toBeOnTheScreen();
    expect(screen.getByText("admin")).toBeOnTheScreen();
  });

  it("is a link named after the home", () => {
    render(<HomeCard home={home} />);

    expect(screen.getByRole("link", { name: "Lake House" })).toBeOnTheScreen();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<HomeCard home={home} onPress={onPress} />);

    await user.press(screen.getByRole("link", { name: "Lake House" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
