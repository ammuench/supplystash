import type { PersistStorage, StorageValue } from "zustand/middleware";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveHomeState = {
  // The user who opened `homeId`. A stored id only counts for this user, so a
  // failed sign-out clear can never hand one account's home to the next.
  owner: string | null;
  homeId: string | null;
  setActiveHome: (userId: string, homeId: string) => void;
  clearActiveHome: () => void;
};

// Exported so tests and the sign-out handler can reach the same key.
export const ACTIVE_HOME_STORAGE_KEY = "active-home";

type PersistedActiveHome = Pick<ActiveHomeState, "owner" | "homeId">;

// `createJSONStorage` lets a parse or read error escape, and persist then
// never marks the store hydrated, so anything waiting on hydration waits
// forever. An unreadable value counts as no active home instead: the user
// opens a home once more, which beats a screen stuck loading.
const activeHomeStorage: PersistStorage<PersistedActiveHome> = {
  getItem: async (name) => {
    try {
      const raw = await AsyncStorage.getItem(name);

      return raw === null ? null : (JSON.parse(raw) as StorageValue<PersistedActiveHome>);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => AsyncStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => AsyncStorage.removeItem(name),
};

// AsyncStorage, not the `query-cache` database: this is one small value, and
// every key in that database is treated as a query row by the restore pass
// (docs/persistence.md). AsyncStorage is localStorage on web, so the active
// home survives a refresh there too.
export const useActiveHomeStore = create<ActiveHomeState>()(
  persist(
    (set) => ({
      owner: null,
      homeId: null,
      setActiveHome: (userId, homeId) => set({ owner: userId, homeId }),
      clearActiveHome: () => set({ owner: null, homeId: null }),
    }),
    {
      name: ACTIVE_HOME_STORAGE_KEY,
      storage: activeHomeStorage,
      partialize: ({ owner, homeId }) => ({ owner, homeId }),
      version: 0,
    },
  ),
);
