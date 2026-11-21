import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { HomeDetails } from "@/components/home-details";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useActiveHomeStore } from "@/state/active-home.store";
import { useHome } from "@/state/homes";
import { useSession } from "@/state/session";

// A deep link can open this screen with nothing under it in the stack.
const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

// One screen for "no such home" and "not your home": telling them apart would
// confirm to an outsider that the id exists.
const Unavailable = ({ message }: { message: string }) => (
  <View className="flex-1 items-center justify-center gap-3">
    <Text className="text-center">{message}</Text>
    <Button variant="outline" onPress={goBack}>
      <Text>Back to homes</Text>
    </Button>
  </View>
);

// No Stack header: the cover banner is the top of the page and carries the
// back button.
export default function HomeDetailsScreen() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  // Read from the cached homes list (state/homes.ts), so it works offline.
  const { data: home, isPending, isError } = useHome(homeId);
  const userId = useSession().user?.id;
  const foundHomeId = home?.id;

  // Opening a home makes it the active home (state/active-home.ts). How other
  // tabs use that is up to them. Only set once the list confirms the user is a
  // member, so an id from a stale link never becomes active.
  useEffect(() => {
    if (userId && foundHomeId) {
      useActiveHomeStore.getState().setActiveHome(userId, foundHomeId);
    }
  }, [userId, foundHomeId]);

  return (
    <AppSafeScreen className="p-4">
      {home ? (
        <HomeDetails home={home} onBack={goBack} />
      ) : isPending ? (
        <Skeleton className="h-60 rounded-lg" aria-label="Loading home" />
      ) : isError ? (
        <Unavailable message="Couldn't load this home." />
      ) : (
        <Unavailable message="Home not found." />
      )}
    </AppSafeScreen>
  );
}
