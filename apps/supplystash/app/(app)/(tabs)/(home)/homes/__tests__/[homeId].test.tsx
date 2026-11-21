import { render, screen, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import type { Home } from "@/state/homes";

import HomeDetailsScreen from "@/app/(app)/(tabs)/(home)/homes/[homeId]";
import { useActiveHomeStore } from "@/state/active-home.store";
import { useHome } from "@/state/homes";

const ME = "user-me";

// The screen is rendered on its own, outside a navigator.
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({ homeId: "home-1" }),
}));
const mockRouter = jest.mocked(router);

jest.mock("lucide-react-native", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ChevronLeftIcon: (require("react-native") as typeof import("react-native")).View,
}));

// The kit Skeleton animates with Reanimated, whose native part does not exist
// under Jest. A plain View keeps the props the test reads.
jest.mock("@/components/ui/skeleton", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native") as typeof import("react-native");

  return { Skeleton: View };
});

jest.mock("@/state/session", () => ({
  useSession: () => ({ user: { id: ME } }),
}));

// How a home is looked up is covered in state/__tests__/homes.test.tsx.
jest.mock("@/state/homes", () => ({ useHome: jest.fn() }));
const mockedUseHome = jest.mocked(useHome);

const HOME: Home = {
  id: "home-1",
  name: "Lake House",
  description: null,
  memberCount: 2,
  role: "owner",
};

const homeResult = (data: Home | null | undefined) =>
  mockedUseHome.mockReturnValue({
    data,
    isPending: data === undefined,
    isError: false,
  } as unknown as ReturnType<typeof useHome>);

const failedResult = () =>
  mockedUseHome.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: true,
  } as unknown as ReturnType<typeof useHome>);

beforeEach(() => {
  useActiveHomeStore.setState({ owner: null, homeId: null });
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
});

describe("# HomeDetailsScreen", () => {
  describe("## active home", () => {
    it("### opening a home the user belongs to makes it active", () => {
      homeResult(HOME);

      render(<HomeDetailsScreen />);

      expect(screen.getByText("Lake House")).toBeOnTheScreen();
      expect(useActiveHomeStore.getState()).toMatchObject({ owner: ME, homeId: "home-1" });
    });

    it("### a home the user is not a member of does not become active", () => {
      homeResult(null);

      render(<HomeDetailsScreen />);

      expect(screen.getByText("Home not found.")).toBeOnTheScreen();
      expect(useActiveHomeStore.getState().homeId).toBeNull();
    });

    it("### nothing becomes active while the home is loading", () => {
      homeResult(undefined);

      render(<HomeDetailsScreen />);

      expect(useActiveHomeStore.getState().homeId).toBeNull();
    });
  });
  describe("## states", () => {
    it("### shows a loading placeholder while the home loads", () => {
      homeResult(undefined);

      render(<HomeDetailsScreen />);

      expect(screen.getByLabelText("Loading home")).toBeOnTheScreen();
    });

    it("### says when the home could not be loaded", () => {
      failedResult();

      render(<HomeDetailsScreen />);

      expect(screen.getByText("Couldn't load this home.")).toBeOnTheScreen();
    });
  });

  describe("## going back", () => {
    it("### the banner's back button returns to the homes list", async () => {
      const user = userEvent.setup();
      homeResult(HOME);
      render(<HomeDetailsScreen />);

      await user.press(screen.getByRole("button", { name: "Back to homes" }));

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it("### a home opened from a link, with nothing under it, goes to the list", async () => {
      const user = userEvent.setup();
      mockRouter.canGoBack.mockReturnValue(false);
      homeResult(null);
      render(<HomeDetailsScreen />);

      await user.press(screen.getByRole("button", { name: "Back to homes" }));

      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });
  });
});
