import { render, screen } from "@testing-library/react-native";
import { useCSSVariable } from "uniwind";

import { Input } from "@/components/ui/input";

// `useCSSVariable` is a jest.fn() from utils/testing/setupTests.ts.
const mockedUseCSSVariable = jest.mocked(useCSSVariable) as jest.Mock;

describe("# Input", () => {
  beforeEach(() => {
    mockedUseCSSVariable.mockReturnValue("#muted-foreground");
  });

  // Guards the Android fix: a `placeholder:` class goes stale on theme change,
  // so the color has to arrive through the prop (STASH-32).
  it("## passes muted-foreground as the placeholder color", () => {
    render(<Input placeholder="Item name" />);

    expect(screen.getByPlaceholderText("Item name")).toHaveProp(
      "placeholderTextColor",
      "#muted-foreground",
    );
  });

  it("## lets the caller override the placeholder color", () => {
    render(<Input placeholder="Item name" placeholderTextColor="#123456" />);

    expect(screen.getByPlaceholderText("Item name")).toHaveProp("placeholderTextColor", "#123456");
  });

  it("## leaves the placeholder color unset when the variable is missing", () => {
    mockedUseCSSVariable.mockReturnValue(undefined);

    render(<Input placeholder="Item name" />);

    expect(screen.getByPlaceholderText("Item name")).not.toHaveProp("placeholderTextColor");
  });
});
