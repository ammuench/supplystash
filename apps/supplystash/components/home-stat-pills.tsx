import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

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

/**
 * A home's stock summary: In stock, Low and Out.
 *
 * @component
 * @example
 * ```tsx
 * <HomeStatPills />
 * ```
 */
export const HomeStatPills = ({ className }: { className?: string }) => (
  <View className={cn("flex-row flex-wrap gap-2", className)}>
    <StatPill tone="info" label="In stock" />
    <StatPill tone="warning" label="Low" />
    <StatPill tone="destructive" label="Out" />
  </View>
);
