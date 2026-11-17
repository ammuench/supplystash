import AsyncStorage from "@react-native-async-storage/async-storage";

import { ACTIVE_HOME_STORAGE_KEY, useActiveHomeStore } from "@/state/active-home.store";

// What the persist middleware writes: the persisted fields plus its version.
const stored = (owner: string | null, homeId: string | null) =>
  JSON.stringify({ state: { owner, homeId }, version: 0 });

beforeEach(async () => {
  await AsyncStorage.clear();
  useActiveHomeStore.setState({ owner: null, homeId: null });
});

describe("# active home store", () => {
  describe("## setActiveHome", () => {
    it("records the home and its owner", () => {
      useActiveHomeStore.getState().setActiveHome("user-me", "home-1");

      expect(useActiveHomeStore.getState()).toMatchObject({ owner: "user-me", homeId: "home-1" });
    });

    it("writes both to storage", async () => {
      useActiveHomeStore.getState().setActiveHome("user-me", "home-1");

      await expect(AsyncStorage.getItem(ACTIVE_HOME_STORAGE_KEY)).resolves.toBe(
        stored("user-me", "home-1"),
      );
    });
  });

  describe("## clearActiveHome", () => {
    it("empties both fields, in memory and in storage", async () => {
      useActiveHomeStore.getState().setActiveHome("user-me", "home-1");

      useActiveHomeStore.getState().clearActiveHome();

      expect(useActiveHomeStore.getState()).toMatchObject({ owner: null, homeId: null });
      await expect(AsyncStorage.getItem(ACTIVE_HOME_STORAGE_KEY)).resolves.toBe(stored(null, null));
    });
  });

  describe("## rehydrate", () => {
    it("restores a value saved by an earlier launch", async () => {
      await AsyncStorage.setItem(ACTIVE_HOME_STORAGE_KEY, stored("user-me", "home-1"));

      await useActiveHomeStore.persist.rehydrate();

      expect(useActiveHomeStore.getState()).toMatchObject({ owner: "user-me", homeId: "home-1" });
      expect(useActiveHomeStore.persist.hasHydrated()).toBe(true);
    });

    it("falls back to no active home when the stored value is unreadable", async () => {
      await AsyncStorage.setItem(ACTIVE_HOME_STORAGE_KEY, "not json");

      await useActiveHomeStore.persist.rehydrate();

      expect(useActiveHomeStore.getState()).toMatchObject({ owner: null, homeId: null });
      expect(useActiveHomeStore.persist.hasHydrated()).toBe(true);
    });
  });
});
