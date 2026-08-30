import type { LucideIcon } from "lucide-react-native";

import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";

import { Alert, AlertTitle } from "@/components/ui/alert";

// lucide-react-native ships ESM from a barrel of thousands of icon modules;
// transforming it would slow every component suite for no benefit here. The
// icon is irrelevant to what these tests assert.
const StubIcon = View as unknown as LucideIcon;

describe("# Alert", () => {
  // `Alert` publishes a class string to every descendant `Text` through
  // TextClassContext. Layout classes meant for the container must not ride
  // along, or spacing passed to the Alert silently reflows its own text.
  it("keeps container layout classes off descendant text", () => {
    render(
      <Alert className="mt-4 px-8" icon={StubIcon}>
        <AlertTitle>Heads up</AlertTitle>
      </Alert>,
    );

    const title = screen.getByText("Heads up");

    expect(title.props.className ?? "").not.toContain("mt-4");
    expect(title.props.className ?? "").not.toContain("px-8");
  });

  it("still applies the container classes to the container", () => {
    render(
      <Alert testID="alert" className="mt-4" icon={StubIcon}>
        <AlertTitle>Heads up</AlertTitle>
      </Alert>,
    );

    expect(screen.getByTestId("alert").props.className).toContain("mt-4");
  });
});
