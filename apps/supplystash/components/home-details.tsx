import { ChevronLeftIcon } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Home } from "@/state/homes";

import { HomeCover } from "@/components/home-cover";
import { HomeStatPills } from "@/components/home-stat-pills";
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

const BackButton = ({ onPress }: { onPress: () => void }) => {
  const foreground = useCSSVariable("--color-foreground");

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label="Back to homes"
      className="absolute top-3 left-3 rounded-full"
      onPress={onPress}
    >
      <Icon
        as={ChevronLeftIcon}
        color={typeof foreground === "string" ? foreground : undefined}
        size={20}
      />
    </Button>
  );
};

/**
 * A home's page: the cover banner with its stock pills, the name and member
 * count, then the item list's view switcher and the list itself. Shared by the
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
    <View className="overflow-hidden rounded-lg bg-card" style={{ borderCurve: "continuous" }}>
      <HomeCover home={home} className="h-34">
        <HomeStatPills className="absolute right-3 bottom-3" />
        {onBack ? <BackButton onPress={onBack} /> : null}
      </HomeCover>
      <View className="gap-1 p-4">
        <Text className="text-xl leading-tight font-semibold">{home.name}</Text>
        <Text className="text-sm leading-tight text-muted-foreground">
          {home.memberCount} {home.memberCount === 1 ? "member" : "members"}
        </Text>
      </View>
    </View>

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
