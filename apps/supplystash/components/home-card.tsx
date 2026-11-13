import { HouseIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Home } from "@/state/homes";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// A 36pt rounded square with a grey wash. Every home gets the same house icon
// for now; a chosen icon and colour land in STASH-65.
const HomeIconTile = () => {
  // Passed as a prop: a color class on the icon did not apply on web (see
  // components/tab-bar-icons.tsx).
  const color = useCSSVariable("--color-muted-foreground");

  return (
    <View
      className="size-9 items-center justify-center rounded-lg bg-muted"
      // iOS draws the corners as a continuous curve (a squircle). Other
      // platforms ignore it and keep the plain rounded corners.
      style={{ borderCurve: "continuous" }}
    >
      <Icon as={HouseIcon} size={20} color={typeof color === "string" ? color : undefined} />
    </View>
  );
};

export type HomeCardProps = {
  home: Home;
  /** Called when the card is pressed. The card does no navigation of its own. */
  onPress?: () => void;
  className?: string;
};

/**
 * One home in a list: its icon, name, member count and the signed-in user's
 * role. Draft UI; the cover area and stat pills from the design land in
 * STASH-56.
 *
 * @component
 * @example
 * ```tsx
 * <HomeCard home={home} onPress={() => router.push(`/homes/${home.id}`)} />
 * ```
 */
export const HomeCard = ({ home, onPress, className }: HomeCardProps) => (
  <Pressable
    role="link"
    aria-label={home.name}
    // Three direct children, so the one `gap` spaces the tile, the name and
    // the details line equally.
    className={cn("gap-2 rounded-lg border border-border p-4", className)}
    onPress={onPress}
  >
    <HomeIconTile />
    <Text className="text-lg leading-tight font-semibold">{home.name}</Text>
    <Text className="text-sm leading-tight text-muted-foreground">
      Members: {home.memberCount} · Your role:{" "}
      {/* The stored role is lowercase (`owner`); capitalized for display only. */}
      <Text className="text-sm leading-tight text-muted-foreground capitalize">{home.role}</Text>
    </Text>
  </Pressable>
);
