import { View } from "react-native";

import type { Home } from "@/state/homes";

import { Badge } from "@/components/ui/badge";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";
import { useHomeCoverColor } from "@/hooks/use-home-cover-color";
import { cn } from "@/lib/utils";

// Colour wash with the home's first letter. No image yet; the colour comes
// from the home's id (lib/home-cover.ts), so it is the same on every device.
const HomeCover = ({ home }: { home: Home }) => {
  const backgroundColor = useHomeCoverColor(home.id);

  return (
    <View
      // `bg-muted` shows only if the cover colour could not be derived.
      className="h-24 items-center justify-center rounded-md bg-muted"
      style={[{ borderCurve: "continuous" }, backgroundColor ? { backgroundColor } : null]}
    >
      <Text className="text-4xl font-bold text-foreground">
        {home.name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

const PILL_CLASSES = {
  info: { badge: "bg-info", text: "text-info-foreground" },
  warning: { badge: "bg-warning", text: "text-warning-foreground" },
  destructive: { badge: "bg-destructive", text: "text-destructive-foreground" },
} as const;

// Static and not tappable. Every count is 0 until STASH-55 adds the stock
// summary counts.
const StatPill = ({ tone, label }: { tone: keyof typeof PILL_CLASSES; label: string }) => (
  <Badge className={cn("border-transparent", PILL_CLASSES[tone].badge)}>
    <Text className={PILL_CLASSES[tone].text}>0 {label}</Text>
  </Badge>
);

export type HomeCardProps = {
  home: Home;
  /** Called when the card is pressed. The card does no navigation of its own. */
  onPress?: () => void;
  className?: string;
};

/**
 * One home in a list: its cover, name, member count and stock pills.
 *
 * @component
 * @example
 * ```tsx
 * <HomeCard home={home} onPress={() => router.push(`/homes/${home.id}`)} />
 * ```
 */
export const HomeCard = ({ home, onPress, className }: HomeCardProps) => (
  <PressableSurface
    role="link"
    aria-label={home.name}
    className={cn("gap-3 rounded-lg border border-border p-3", className)}
    onPress={onPress}
  >
    <HomeCover home={home} />
    <View className="gap-1">
      <Text className="text-lg leading-tight font-semibold">{home.name}</Text>
      <Text className="text-sm leading-tight text-muted-foreground">
        {home.memberCount} {home.memberCount === 1 ? "member" : "members"}
      </Text>
    </View>
    <View className="flex-row flex-wrap gap-2">
      <StatPill tone="info" label="In stock" />
      <StatPill tone="warning" label="Low" />
      <StatPill tone="destructive" label="Out" />
    </View>
  </PressableSurface>
);
