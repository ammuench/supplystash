import { render, screen } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import { HomeSummaryCard } from "@/components/home-summary-card";

const home = (id: string, name: string, memberCount = 3): Home => ({
  id,
  name,
  description: null,
  memberCount,
  role: "owner",
});

describe("# HomeSummaryCard", () => {
  it("shows the name, member count and stock pills", () => {
    render(<HomeSummaryCard home={home("home-1", "Lake House")} />);

    expect(screen.getByText("Lake House")).toBeOnTheScreen();
    expect(screen.getByText("3 members")).toBeOnTheScreen();
    expect(screen.getByText("0 In stock")).toBeOnTheScreen();
  });

  it("says member, not members, for one", () => {
    render(<HomeSummaryCard home={home("home-1", "Lake House", 1)} />);

    expect(screen.getByText("1 member")).toBeOnTheScreen();
  });

  // The tag pairs a list card with the same home's details header. It must
  // differ per home, or opening one card would animate another.
  it("tags the card with the home's id for the shared transition", () => {
    render(
      <>
        <HomeSummaryCard home={home("home-1", "Lake House")} />
        <HomeSummaryCard home={home("home-2", "City Flat")} />
      </>,
    );

    expect(screen.UNSAFE_getByProps({ sharedTransitionTag: "home-card-home-1" })).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ sharedTransitionTag: "home-card-home-2" })).toBeTruthy();
  });
});
