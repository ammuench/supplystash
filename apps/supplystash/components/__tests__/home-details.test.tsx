import { render, screen } from "@testing-library/react-native";

import { HomeDetails } from "@/components/home-details";

describe("# HomeDetails", () => {
  it("shows the member count and the user's role", () => {
    render(
      <HomeDetails
        home={{
          id: "home-1",
          name: "Lake House",
          description: null,
          memberCount: 3,
          role: "admin",
        }}
      />,
    );

    expect(screen.getByText("Members: 3")).toBeOnTheScreen();
    expect(screen.getByText("admin")).toBeOnTheScreen();
  });
});
