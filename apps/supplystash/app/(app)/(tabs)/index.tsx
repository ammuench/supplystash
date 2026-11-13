import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { HomeCard } from "@/components/home-card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useHomes } from "@/state/homes";

// Temporary stand-in: the real homes index lands in STASH-56 and replaces this
// file. It exists so the create home flow has a way in, and so `useHomes` can
// be checked on screen against a real database.
export default function HomeScreen() {
  const { data: homes, isPending, isError } = useHomes();

  return (
    <AppSafeScreen className="gap-4 p-4">
      {/* Outside the scroller, so the title stays at the top. */}
      <Text className="text-xl font-semibold">Homes</Text>

      {/* `flex-grow` makes the content at least as tall as the space under the
          title, so `justify-center` centers a short list in it. A list taller
          than that space has no spare room to center in, and scrolls from the
          top. */}
      <ScrollView className="flex-1" contentContainerClassName="flex-grow justify-center gap-4">
        {isPending ? <Text>Loading…</Text> : null}
        {isError ? <Text className="text-destructive">Couldn&apos;t load your homes.</Text> : null}
        {homes?.length === 0 ? <Text>You have no homes yet.</Text> : null}

        <View className="gap-2">
          {homes?.map((home) => (
            <HomeCard
              key={home.id}
              home={home}
              onPress={() =>
                router.push({ pathname: "/homes/[homeId]", params: { homeId: home.id } })
              }
            />
          ))}
        </View>

        <Button onPress={() => router.push("/homes/new")}>
          <Text>Create home</Text>
        </Button>
      </ScrollView>
    </AppSafeScreen>
  );
}
