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
      // Known race, left unguarded on purpose (PR #34 review). The stored
      // value is read once, async, at launch. A setter that runs before that
      // read finishes is overwritten by it, and the old value is saved back.
      // Nothing orders the callers after that read; timing does.
      // `[homeId].tsx` renders only after the session and cache-claim gates,
      // and the sign-out clear waits on the session read plus a network call.
      // Both start later and take longer, so this needs an unusually slow
      // read. The owner check in useActiveHome keeps it from crossing
      // accounts, but not from returning a stale home to the same user.
      //
      // Symptom, if a new caller ever runs before those gates: a home the
      // user just opened is replaced by the one they had open before, or a
      // home comes back after the same user signs out and in again. Fix: pass a `merge` to
      // `persist` that keeps the in-memory value when a setter ran before
      // hydration.
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
