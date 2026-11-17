import { render, screen, userEvent } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import { HomeCard } from "@/components/home-card";

const home: Home = {
  id: "home-1",
  name: "lake House",
  description: null,
  memberCount: 3,
  role: "admin",
};

describe("# HomeCard", () => {
  it("shows the first letter of the name, capitalized, on the cover", () => {
    render(<HomeCard home={home} />);

    expect(screen.getByText("L")).toBeOnTheScreen();
  });

  it("shows the home's name and member count", () => {
    render(<HomeCard home={home} />);

    expect(screen.getByText("lake House")).toBeOnTheScreen();
    expect(screen.getByText("3 members")).toBeOnTheScreen();
  });

  it("says member, not members, for one person", () => {
    render(<HomeCard home={{ ...home, memberCount: 1 }} />);

    expect(screen.getByText("1 member")).toBeOnTheScreen();
  });

  it("shows the three stock pills at 0", () => {
    render(<HomeCard home={home} />);

    expect(screen.getByText("0 In stock")).toBeOnTheScreen();
    expect(screen.getByText("0 Low")).toBeOnTheScreen();
    expect(screen.getByText("0 Out")).toBeOnTheScreen();
  });

  it("is a link named after the home", () => {
    render(<HomeCard home={home} />);

    expect(screen.getByRole("link", { name: "lake House" })).toBeOnTheScreen();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<HomeCard home={home} onPress={onPress} />);

    await user.press(screen.getByRole("link", { name: "lake House" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
