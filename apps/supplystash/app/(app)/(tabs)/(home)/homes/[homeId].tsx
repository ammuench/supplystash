import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { Text } from "@/components/ui/text";
import { useActiveHomeStore } from "@/state/active-home.store";
import { useHome } from "@/state/homes";
import { useSession } from "@/state/session";

// Temporary stand-in: the real home details screen lands in STASH-58 and
// replaces this file. It exists so the create home flow has somewhere to land,
// and so `useHome` can be checked on screen against a real database.
export default function HomeDetailsScreen() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  const { data: home, isPending, isError } = useHome(homeId);
  const userId = useSession().user?.id;
  const foundHomeId = home?.id;

  // Opening a home makes it the active home (state/active-home.ts). How other
  // tabs use that is up to them. Only set once the list confirms the user is a
  // member, so an id from a stale link never becomes active. STASH-58 replaces
  // this screen; this effect moves with it.
  useEffect(() => {
    if (userId && foundHomeId) {
      useActiveHomeStore.getState().setActiveHome(userId, foundHomeId);
    }
  }, [userId, foundHomeId]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: home?.name ?? "Home" }} />
      <AppSafeScreen className="gap-2 p-4" edges={["bottom", "left", "right"]}>
        {isPending ? <Text>Loading…</Text> : null}
        {isError ? <Text className="text-destructive">Couldn&apos;t load this home.</Text> : null}
        {home === null ? <Text>Home not found.</Text> : null}
        {home ? (
          <>
            <Text className="text-xl font-semibold">{home.name}</Text>
            <Text>Members: {home.memberCount}</Text>
            <Text>
              Your role: <Text className="capitalize">{home.role}</Text>
            </Text>
          </>
        ) : null}
      </AppSafeScreen>
    </>
  );
}
