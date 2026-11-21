import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { BlockedControl } from "@/components/blocked-control";
import { HomeCard } from "@/components/home-card";
import { HomeDetails } from "@/components/home-details";
import { HomesEmptyState } from "@/components/homes-empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useHomes } from "@/state/homes";

const openCreateHome = () => router.push("/homes/new");

// Five, so they fill even a tall screen; the scroller is locked while they
// show. h-52 is about a home card's height, so the list does not jump when it
// replaces them.
const SKELETON_COUNT = 5;

const LoadingCards = () => (
  <View className="gap-4" aria-label="Loading homes">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} className="h-52 rounded-lg" />
    ))}
  </View>
);

export default function HomeScreen() {
  // Cached homes render straight away, offline too: the query cache is
  // persisted (docs/persistence.md), so `isPending` is only a first load.
  const { data: homes, isPending, isError, isFetching, refetch } = useHomes();
  const hasHomes = !!homes && homes.length > 0;
  // The empty state has its own setup card, so Add shows only above a list,
  // or above the skeletons that stand in for one.
  const showAdd = isPending || hasHomes;
  // With one home there is nothing to pick, so the tab is that home's page.
  // Counted from the list, not the active home: a second home brings the list
  // back whichever home is active. Add stays, or a second home could never be
  // made.
  const onlyHome = homes?.length === 1 ? homes[0] : undefined;

  return (
    <AppSafeScreen className="gap-4 p-4">
      {/* Outside the scroller, so the title and Add stay at the top. */}
      {/* With one home, its page below shows the name, so the title goes. */}
      <View className={onlyHome ? "flex-row justify-end" : "flex-row items-center justify-between"}>
        {onlyHome ? null : <Text className="text-xl font-semibold">Homes</Text>}
        {showAdd ? (
          <BlockedControl action="membership" label="Add home">
            {(blocked) => (
              // Also disabled while loading: until the list arrives we do not
              // know yet whether the empty state should take over.
              <Button size="sm" disabled={blocked || isPending} onPress={openCreateHome}>
                <Text>Add</Text>
              </Button>
            )}
          </BlockedControl>
        ) : null}
      </View>

      {onlyHome ? (
        <HomeDetails home={onlyHome} />
      ) : (
        <ScrollView
          className="flex-1"
          scrollEnabled={!isPending}
          // Skeletons and cards are top-aligned, so one replaces the other in
          // place. Only the empty state and the error message center, using
          // `flex-grow` to fill the space under the title.
          contentContainerClassName={
            isPending || hasHomes ? "gap-4 pb-4" : "flex-grow justify-center"
          }
        >
          {isPending ? (
            <LoadingCards />
          ) : hasHomes ? (
            homes.map((home) => (
              <HomeCard
                key={home.id}
                home={home}
                onPress={() =>
                  router.push({ pathname: "/homes/[homeId]", params: { homeId: home.id } })
                }
              />
            ))
          ) : isError ? (
            // The offline and unreachable bars already say why; this only says what.
            <View className="items-center gap-3">
              <Text className="text-center text-destructive">Couldn&apos;t load your homes.</Text>
              {/* A read, not a write, so no BlockedControl: offline, TanStack
                Query holds the retry and runs it on reconnect. */}
              <Button variant="outline" disabled={isFetching} onPress={() => void refetch()}>
                <Text>{isFetching ? "Retrying…" : "Retry"}</Text>
              </Button>
            </View>
          ) : (
            <HomesEmptyState onCreate={openCreateHome} />
          )}
        </ScrollView>
      )}
    </AppSafeScreen>
  );
}
