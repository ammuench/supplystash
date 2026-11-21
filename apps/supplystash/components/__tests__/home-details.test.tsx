import { render, screen, userEvent } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import { HomeDetails } from "@/components/home-details";

jest.mock("lucide-react-native", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ChevronLeftIcon: (require("react-native") as typeof import("react-native")).View,
}));

const HOME: Home = {
  id: "home-1",
  name: "Lake House",
  description: null,
  memberCount: 3,
  role: "admin",
};

describe("# HomeDetails", () => {
  it("shows the name, member count and stock pills", () => {
    render(<HomeDetails home={HOME} />);

    expect(screen.getByText("Lake House")).toBeOnTheScreen();
    expect(screen.getByText("3 members")).toBeOnTheScreen();
    expect(screen.getByText("0 In stock")).toBeOnTheScreen();
    expect(screen.getByText("0 Low")).toBeOnTheScreen();
    expect(screen.getByText("0 Out")).toBeOnTheScreen();
  });

  it("says member, not members, for one", () => {
    render(<HomeDetails home={{ ...HOME, memberCount: 1 }} />);

    expect(screen.getByText("1 member")).toBeOnTheScreen();
  });

  describe("## back button", () => {
    it("### shows when there is somewhere to go back to", async () => {
      const user = userEvent.setup();
      const onBack = jest.fn();
      render(<HomeDetails home={HOME} onBack={onBack} />);

      await user.press(screen.getByRole("button", { name: "Back to homes" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("### is left out otherwise", () => {
      render(<HomeDetails home={HOME} />);

      expect(screen.queryByRole("button", { name: "Back to homes" })).not.toBeOnTheScreen();
    });
  });

  describe("## item views", () => {
    it("### shows all three, with All items selected", () => {
      render(<HomeDetails home={HOME} />);

      expect(screen.getByRole("tab", { name: "All items" })).toBeSelected();
      expect(screen.getByRole("tab", { name: "Rooms" })).not.toBeSelected();
      expect(screen.getByRole("tab", { name: "Categories" })).not.toBeSelected();
    });

    // Placeholders until there are items to group.
    it("### does nothing when another view is tapped", async () => {
      const user = userEvent.setup();
      render(<HomeDetails home={HOME} />);

      await user.press(screen.getByRole("tab", { name: "Rooms" }));

      expect(screen.getByRole("tab", { name: "All items" })).toBeSelected();
      expect(screen.getByText("Items you add will show here.")).toBeOnTheScreen();
    });
  });
});
