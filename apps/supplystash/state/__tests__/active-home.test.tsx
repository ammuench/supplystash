import { act, renderHook } from "@testing-library/react-native";

import type { Home } from "@/state/homes";

import { useActiveHome } from "@/state/active-home";
import { useActiveHomeStore } from "@/state/active-home.store";
import { useHomes } from "@/state/homes";

const ME = "user-me";
const OTHER = "user-other";

let mockUser: { id: string } | null = { id: ME };
jest.mock("@/state/session", () => ({
  useSession: () => ({ user: mockUser }),
}));

// How the list is fetched is covered in state/__tests__/homes.test.tsx. Here
// only its result matters.
jest.mock("@/state/homes", () => ({ useHomes: jest.fn() }));
const mockedUseHomes = jest.mocked(useHomes);

const home = (id: string): Home => ({
  id,
  name: `Home ${id}`,
  description: null,
  memberCount: 1,
  role: "owner",
});

const homesLoaded = (homes: Home[]) =>
  mockedUseHomes.mockReturnValue({
    data: homes,
    isPending: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useHomes>);

const homesPending = () =>
  mockedUseHomes.mockReturnValue({
    data: undefined,
    isPending: true,
    isSuccess: false,
  } as unknown as ReturnType<typeof useHomes>);

const homesFailed = () =>
  mockedUseHomes.mockReturnValue({
    data: undefined,
    isPending: false,
    isSuccess: false,
  } as unknown as ReturnType<typeof useHomes>);

beforeEach(async () => {
  mockUser = { id: ME };
  await useActiveHomeStore.persist.rehydrate();
  useActiveHomeStore.setState({ owner: null, homeId: null });
});

describe("# useActiveHome", () => {
  describe("## a stored home", () => {
    it("is active when it is the user's and still in the list", () => {
      useActiveHomeStore.setState({ owner: ME, homeId: "b" });
      homesLoaded([home("a"), home("b")]);

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBe("b");
      expect(result.current.home?.name).toBe("Home b");
      expect(result.current.isLoading).toBe(false);
    });

    it("is ignored, not cleared, when it is no longer in the list", () => {
      useActiveHomeStore.setState({ owner: ME, homeId: "gone" });
      homesLoaded([home("a"), home("b")]);

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBeUndefined();
      expect(useActiveHomeStore.getState().homeId).toBe("gone");
    });

    it("is ignored, not cleared, when another user stored it", () => {
      useActiveHomeStore.setState({ owner: OTHER, homeId: "b" });
      homesLoaded([home("a"), home("b")]);

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBeUndefined();
      expect(useActiveHomeStore.getState().homeId).toBe("b");
    });

    it("is kept while the list is still loading", () => {
      useActiveHomeStore.setState({ owner: ME, homeId: "b" });
      homesPending();

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.isLoading).toBe(true);
      expect(useActiveHomeStore.getState().homeId).toBe("b");
    });
  });

  describe("## no stored home", () => {
    it("uses the only home, without saving it", () => {
      homesLoaded([home("a")]);

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBe("a");
      expect(useActiveHomeStore.getState().homeId).toBeNull();
    });

    it("falls back to the only home when the stored id is stale", () => {
      useActiveHomeStore.setState({ owner: ME, homeId: "gone" });
      homesLoaded([home("a")]);

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBe("a");
    });

    it.each([
      ["no homes", []],
      ["two homes", [home("a"), home("b")]],
    ])("is undefined with %s", (_label, homes) => {
      homesLoaded(homes);

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBeUndefined();
      expect(result.current.home).toBeUndefined();
    });

    it("is undefined, and not loading, when the list failed to load", () => {
      homesFailed();

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.homeId).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("## loading", () => {
    it("waits for the stored value to be read", async () => {
      homesLoaded([home("a")]);
      const hasHydrated = jest
        .spyOn(useActiveHomeStore.persist, "hasHydrated")
        .mockReturnValue(false);

      const { result } = renderHook(() => useActiveHome());
      expect(result.current.isLoading).toBe(true);

      hasHydrated.mockRestore();
      await act(() => useActiveHomeStore.persist.rehydrate());

      expect(result.current.isLoading).toBe(false);
    });

    it("is not loading when signed out", () => {
      mockUser = null;
      homesPending();

      const { result } = renderHook(() => useActiveHome());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.homeId).toBeUndefined();
    });
  });

  describe("## setActiveHome", () => {
    it("records the home for the signed-in user", () => {
      homesLoaded([home("a"), home("b")]);
      const { result } = renderHook(() => useActiveHome());

      act(() => result.current.setActiveHome("b"));

      expect(useActiveHomeStore.getState()).toMatchObject({ owner: ME, homeId: "b" });
      expect(result.current.homeId).toBe("b");
    });

    it("does nothing when signed out", () => {
      mockUser = null;
      homesLoaded([]);
      const { result } = renderHook(() => useActiveHome());

      act(() => result.current.setActiveHome("b"));

      expect(useActiveHomeStore.getState().homeId).toBeNull();
    });
  });
});
