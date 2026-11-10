import { router, Stack } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { Text } from "@/components/ui/text";

import TabsLayout from "../_layout";
import AddTabRoute from "../add";

// lucide-react-native ships ESM from a barrel of thousands of icon modules, and
// transforming it would slow every suite. The icons are irrelevant here.
jest.mock("lucide-react-native", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native") as typeof import("react-native");

  return {
    CircleUserIcon: View,
    HouseIcon: View,
    ListChecksIcon: View,
    PlusIcon: View,
    SettingsIcon: View,
  };
});
// utils/testing/setupTests.ts stubs expo-linking down to `createURL` for the
// auth suites; the router needs the real module to subscribe to URLs.
jest.mock("expo-linking", () => jest.requireActual("expo-linking"));

// Only the center slot is under test: it is the one piece of tab behavior this
// app wrote itself. Plain tab switching is the library's job and is not
// re-tested here.
//
// The real tabs layout and the real center-slot route, over stub screens with
// the same shape as app/(app). Screen text ends in "screen" so it never
// collides with a tab label.
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/index": () => <Text>Home screen</Text>,
  "(tabs)/lists": () => <Text>Lists screen</Text>,
  "(tabs)/add": AddTabRoute,
  "(tabs)/settings": () => <Text>Settings screen</Text>,
  "(tabs)/account": () => <Text>Account screen</Text>,
  "add-item": () => <Text>Add Item screen</Text>,
};

describe("# TabsLayout", () => {
  describe("## add item", () => {
    it("### pressing the center slot pushes the add-item screen", () => {
      const view = renderRouter(routes, { initialUrl: "/lists" });

      fireEvent.press(screen.getByText("Add Item"));

      expect(view.getPathname()).toBe("/add-item");
      expect(screen.getByText("Add Item screen")).toBeOnTheScreen();
    });

    it("### going back returns to the tab the user was on", () => {
      const view = renderRouter(routes, { initialUrl: "/lists" });
      fireEvent.press(screen.getByText("Add Item"));

      act(() => router.back());

      expect(view.getPathname()).toBe("/lists");
      expect(screen.getByText("Lists screen")).toBeOnTheScreen();
    });

    it("### a direct visit to the center slot's route lands on add-item", () => {
      const view = renderRouter(routes, { initialUrl: "/add" });

      expect(view.getPathname()).toBe("/add-item");
    });
  });
});
