import { render, screen } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import HomeDetailsScreen from "@/app/(app)/(tabs)/(home)/homes/[homeId]";
import { useActiveHomeStore } from "@/state/active-home.store";
import { useHome } from "@/state/homes";

const ME = "user-me";

// The screen is rendered on its own, outside a navigator: `Stack.Screen` only
// sets the header.
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ homeId: "home-1" }),
}));

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

beforeEach(() => {
  useActiveHomeStore.setState({ owner: null, homeId: null });
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
});
