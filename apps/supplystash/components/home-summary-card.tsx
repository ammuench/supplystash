import { View } from "react-native";
import Animated, { SharedTransition } from "react-native-reanimated";

import type { Home } from "@/state/homes";

import { HomeCover } from "@/components/home-cover";
import { HomeStatPills } from "@/components/home-stat-pills";
import { Text } from "@/components/ui/text";

/** How long the card takes to travel between the list and the details header.
 * Reanimated's 500 ms default felt slow. */
export const HOME_CARD_TRANSITION_MS = 200;

const cardTransition = new SharedTransition().duration(HOME_CARD_TRANSITION_MS);

/**
 * A home at a glance: the cover with its stock pills, then the name and member
 * count. The homes list shows it as a card and the details screen as its
 * header.
 *
 * Both share one transition tag per home, so on iOS and Android the whole card
 * travels into the details header when the home opens, and back on the way
 * out. The (home) stack's layout sets up the boundary this needs. The two must
 * keep the same layout and cover height, or the content snaps at the end of
 * the move. Web skips the animation.
 *
 * @component
 * @example
 * ```tsx
 * <HomeSummaryCard home={home} />
 * ```
 */
export const HomeSummaryCard = ({
  home,
  children,
}: {
  home: Home;
  /** Laid over the cover, such as the details screen's back button. */
  children?: React.ReactNode;
}) => (
  // Two layers. The outer one is Reanimated's own view and carries only the
  // transition: Uniwind's className wrapper copies the props it passes on, and
  // the copy loses the transition object's methods (a crash on native). The
  // inner view carries the styling and moves with it.
  <Animated.View
    sharedTransitionTag={`home-card-${home.id}`}
    sharedTransitionStyle={cardTransition}
  >
    <View className="overflow-hidden rounded-lg bg-card" style={{ borderCurve: "continuous" }}>
      <HomeCover home={home} className="h-34">
        <HomeStatPills className="absolute right-3 bottom-3" />
        {children}
      </HomeCover>
      <View className="gap-1 p-4">
        <Text className="text-xl leading-tight font-semibold">{home.name}</Text>
        <Text className="text-sm leading-tight text-muted-foreground">
          {home.memberCount} {home.memberCount === 1 ? "member" : "members"}
        </Text>
      </View>
    </View>
  </Animated.View>
);
