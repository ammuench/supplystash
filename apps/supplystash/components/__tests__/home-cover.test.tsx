import { render, screen } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import { HomeCover } from "@/components/home-cover";

const home = (id: string, name: string): Home => ({
  id,
  name,
  description: null,
  memberCount: 1,
  role: "owner",
});

describe("# HomeCover", () => {
  it("shows the home's first letter", () => {
    render(<HomeCover home={home("home-1", " lake house")} />);

    expect(screen.getByText("L")).toBeOnTheScreen();
  });
});
