import { useIsFocused } from "expo-router";
import { ChevronLeftIcon } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import type { Home } from "@/state/homes";

import { HOME_CARD_TRANSITION_MS, HomeSummaryCard } from "@/components/home-summary-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";

// What the item list below will group by. Placeholders: tapping one does
// nothing until the Inventory Core project gives the list something to show
// (STASH-55).
const ITEM_VIEWS = [
  { value: "all", label: "All items" },
  { value: "rooms", label: "Rooms" },
  { value: "categories", label: "Categories" },
] as const;

const ignoreViewChange = () => {};

// The card arrives through the shared transition and the button is not part of
// the card it comes from, so it fades in once the move is done instead of
// popping in. Leaving, the screen goes away the moment navigation starts, too
// soon for a fade, so a press fades the button out first and navigates after.
// A swipe back fades it when the screen loses focus.
const FADE_IN_MS = 150;
const FADE_OUT_MS = 100;

const BackButton = ({ onPress }: { onPress: () => void }) => {
  const foreground = useCSSVariable("--color-foreground");
  const isFocused = useIsFocused();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = isFocused
      ? withDelay(HOME_CARD_TRANSITION_MS, withTiming(1, { duration: FADE_IN_MS }))
      : withTiming(0, { duration: FADE_OUT_MS });
  }, [isFocused, opacity]);

  const fadeOutThenLeave = () => {
    opacity.value = withTiming(0, { duration: FADE_OUT_MS });
    setTimeout(onPress, FADE_OUT_MS);
  };

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    // Reanimated's own view with plain styles: Uniwind's className wrapper
    // turns the animated style into a static one, so the fade never ran.
    <Animated.View style={[{ position: "absolute", top: 12, left: 12 }, fadeStyle]}>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Back to homes"
        className="rounded-full"
        onPress={fadeOutThenLeave}
      >
        <Icon
          as={ChevronLeftIcon}
          color={typeof foreground === "string" ? foreground : undefined}
          size={20}
        />
      </Button>
    </Animated.View>
  );
};

/**
 * A home's page: its summary card (cover, stock pills, name and member count),
 * then the item list's view switcher and the list itself. Shared by the
 * home details screen and by the Home tab when the user has only one home.
 *
 * @component
 * @example
 * ```tsx
 * <HomeDetails home={home} onBack={() => router.back()} />
 * ```
 */
export const HomeDetails = ({
  home,
  onBack,
}: {
  home: Home;
  /** Shows a back button on the banner. Omit where there is nowhere to go back to. */
  onBack?: () => void;
}) => (
  <View className="flex-1 gap-4">
    <HomeSummaryCard home={home}>{onBack ? <BackButton onPress={onBack} /> : null}</HomeSummaryCard>

    <Tabs value="all" onValueChange={ignoreViewChange}>
      <TabsList>
        {ITEM_VIEWS.map((view) => (
          <TabsTrigger key={view.value} value={view.value}>
            <Text>{view.label}</Text>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>

    <View className="flex-1 items-center justify-center rounded-lg border border-dashed border-border p-6">
      <Text className="text-center text-muted-foreground">Items you add will show here.</Text>
    </View>
  </View>
);
