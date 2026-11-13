import { Stack, useLocalSearchParams } from "expo-router";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { Text } from "@/components/ui/text";
import { useHome } from "@/state/homes";

// Temporary stand-in: the real home details screen lands in STASH-58 and
// replaces this file. It exists so the create home flow has somewhere to land,
// and so `useHome` can be checked on screen against a real database.
export default function HomeDetailsScreen() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  const { data: home, isPending, isError } = useHome(homeId);

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
