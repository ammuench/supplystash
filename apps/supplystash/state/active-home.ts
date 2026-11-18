import { useSyncExternalStore } from "react";

import type { Home } from "@/state/homes";

import { useActiveHomeStore } from "@/state/active-home.store";
import { useHomes } from "@/state/homes";
import { useSession } from "@/state/session";

const subscribeToHydration = (onChange: () => void) =>
  useActiveHomeStore.persist.onFinishHydration(onChange);

const hasHydrated = () => useActiveHomeStore.persist.hasHydrated();

/**
 * The home Lists, Add Item and every home-scoped query act on.
 *
 * - The home the user last opened, if it belongs to them and they are still a
 *   member of it.
 * - Otherwise, with exactly one home, that home. Derived, not saved: it should
 *   stop being active the moment a second home appears.
 * - Otherwise `undefined`, which suits `enabled: !!homeId`
 *   (docs/query-keys.md rule 5).
 *
 * `isLoading` is true until both the stored value and the homes list are read.
 * The splash does not wait on it, because the Home tab never needs it.
 */
export const useActiveHome = () => {
  const { user } = useSession();
  const homes = useHomes();
  const isHydrated = useSyncExternalStore(subscribeToHydration, hasHydrated);
  const owner = useActiveHomeStore((state) => state.owner);
  const storedHomeId = useActiveHomeStore((state) => state.homeId);

  // An id that is another account's, or no longer in the list (home deleted,
  // user removed), is ignored rather than cleared. The hook stays read-only,
  // the next `setActiveHome` or sign-out overwrites it, and a user invited
  // back gets their last home back.
  const ownHomeId = user && owner === user.id ? storedHomeId : null;
  const storedHome = ownHomeId ? homes.data?.find((home) => home.id === ownHomeId) : undefined;

  const home: Home | undefined =
    storedHome ?? (homes.data?.length === 1 ? homes.data[0] : undefined);

  const setActiveHome = (homeId: string) => {
    if (user) {
      useActiveHomeStore.getState().setActiveHome(user.id, homeId);
    }
  };

  return {
    homeId: home?.id,
    home,
    // Signed out, the homes query is disabled and stays pending forever, so
    // it does not count as loading.
    isLoading: !isHydrated || (!!user && homes.isPending),
    setActiveHome,
  };
};
