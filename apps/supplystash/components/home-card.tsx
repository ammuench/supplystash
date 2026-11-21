import { View } from "react-native";

import type { Home } from "@/state/homes";

import { HomeCover } from "@/components/home-cover";
import { HomeStatPills } from "@/components/home-stat-pills";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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
    <HomeCover home={home} className="h-24 rounded-md" />
    <View className="gap-1">
      <Text className="text-lg leading-tight font-semibold">{home.name}</Text>
      <Text className="text-sm leading-tight text-muted-foreground">
        {home.memberCount} {home.memberCount === 1 ? "member" : "members"}
      </Text>
    </View>
    <HomeStatPills />
  </PressableSurface>
);
