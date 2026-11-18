import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import type { Home } from "@/state/homes";

import HomeScreen from "@/app/(app)/(tabs)/(home)/index";
import { toastInfo } from "@/lib/toast";
import { useHomes } from "@/state/homes";

// lucide-react-native ships ESM from a barrel of thousands of icon modules, and
// transforming it would slow every suite. The icon is irrelevant here.
jest.mock("lucide-react-native", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native") as typeof import("react-native");

  return { HousePlusIcon: View };
});

// The kit Skeleton animates with Reanimated, whose native part does not exist
// under Jest. A plain View keeps the props the test reads.
jest.mock("@/components/ui/skeleton", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native") as typeof import("react-native");

  return { Skeleton: View };
});

jest.mock("expo-router", () => ({
  ...(jest.requireActual("expo-router") as object),
  router: { push: jest.fn() },
}));

jest.mock("@/lib/toast", () => ({ toastInfo: jest.fn() }));

// The screen's job is choosing a state from the query result; how that result
// is fetched and cached is covered in state/__tests__/homes.test.tsx.
jest.mock("@/state/homes", () => ({ useHomes: jest.fn() }));

const mockUseHomes = jest.mocked(useHomes);

const homesResult = (overrides: Partial<ReturnType<typeof useHomes>>) =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useHomes>;

const HOMES: Home[] = [
  { id: "home-1", name: "Apartment", description: null, memberCount: 1, role: "owner" },
  { id: "home-2", name: "Lake House", description: null, memberCount: 3, role: "member" },
];

const OFFLINE_COPY = "Cannot perform that action while app is offline.";

let client: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  // `gcTime: Infinity` so no 5-minute gc timer outlives the test run.
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
});

afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

// The blocked-reason hooks read connectivity through TanStack Query.
const renderScreen = () =>
  render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );

const goOffline = () => act(() => onlineManager.setOnline(false));

// `fireEvent`, not `userEvent`: the cover marks itself disabled for screen
// readers, and userEvent will not press a disabled element.

describe("# HomeScreen", () => {
  describe("## loading", () => {
    it("shows placeholder cards and no empty state", () => {
      mockUseHomes.mockReturnValue(homesResult({ isPending: true }));

      renderScreen();

      expect(screen.getByLabelText("Loading homes")).toBeOnTheScreen();
      expect(screen.queryByText("Let's create your first home")).not.toBeOnTheScreen();
    });

    it("keeps the header with Add shown but disabled", () => {
      mockUseHomes.mockReturnValue(homesResult({ isPending: true }));

      renderScreen();

      expect(screen.getByText("Homes")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });
  });

  describe("## no homes", () => {
    beforeEach(() => mockUseHomes.mockReturnValue(homesResult({ data: [] })));

    it("shows the first home prompt and no Add button", () => {
      renderScreen();

      expect(screen.getByText("Let's create your first home")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("opens the create home flow from the setup card", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByRole("button", { name: "Set up a home" }));

      expect(router.push).toHaveBeenCalledWith("/homes/new");
    });

    it("blocks the setup card while offline", () => {
      renderScreen();
      goOffline();

      fireEvent.press(screen.getByRole("button", { name: "Set up a home" }));

      expect(router.push).not.toHaveBeenCalled();
      expect(toastInfo).toHaveBeenCalledWith(OFFLINE_COPY, expect.any(String));
    });
  });

  describe("## one home", () => {
    beforeEach(() => mockUseHomes.mockReturnValue(homesResult({ data: [HOMES[1]] })));

    it("shows that home in place of the list", () => {
      renderScreen();

      expect(screen.getByText("Lake House")).toBeOnTheScreen();
      expect(screen.getByText("Members: 3")).toBeOnTheScreen();
      expect(screen.queryByText("Homes")).not.toBeOnTheScreen();
      expect(screen.queryByRole("link", { name: "Lake House" })).not.toBeOnTheScreen();
    });

    it("keeps Add, so a second home can be made", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(router.push).toHaveBeenCalledWith("/homes/new");
    });
  });

  describe("## homes", () => {
    beforeEach(() => mockUseHomes.mockReturnValue(homesResult({ data: HOMES })));

    it("shows a card per home", () => {
      renderScreen();

      expect(screen.getByRole("link", { name: "Apartment" })).toBeOnTheScreen();
      expect(screen.getByRole("link", { name: "Lake House" })).toBeOnTheScreen();
      expect(screen.queryByText("Let's create your first home")).not.toBeOnTheScreen();
    });

    it("opens a home's details from its card", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByRole("link", { name: "Lake House" }));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/homes/[homeId]",
        params: { homeId: "home-2" },
      });
    });

    it("opens the create home flow from Add", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(router.push).toHaveBeenCalledWith("/homes/new");
    });

    it("blocks Add while offline but keeps the cards", () => {
      renderScreen();
      goOffline();

      fireEvent.press(screen.getByRole("button", { name: "Add home" }));

      expect(router.push).not.toHaveBeenCalled();
      expect(toastInfo).toHaveBeenCalledWith(OFFLINE_COPY, expect.any(String));
      expect(screen.getByRole("link", { name: "Apartment" })).toBeOnTheScreen();
    });
  });

  describe("## load failed with nothing cached", () => {
    it("says the homes could not load, not that there are none", () => {
      mockUseHomes.mockReturnValue(homesResult({ isError: true }));

      renderScreen();

      expect(screen.getByText("Couldn't load your homes.")).toBeOnTheScreen();
      expect(screen.queryByText("Let's create your first home")).not.toBeOnTheScreen();
    });

    it("retries the load from the Retry button", async () => {
      const refetch = jest.fn();
      mockUseHomes.mockReturnValue(homesResult({ isError: true, refetch } as never));
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByRole("button", { name: "Retry" }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("disables Retry while the retry runs", () => {
      mockUseHomes.mockReturnValue(homesResult({ isError: true, isFetching: true }));

      renderScreen();

      expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
    });
  });
});
