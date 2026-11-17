import { HousePlusIcon } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { BlockedControl } from "@/components/blocked-control";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";

export type HomesEmptyStateProps = {
  /** Opens the create home flow. */
  onCreate: () => void;
};

/**
 * Shown on the Home tab when the user belongs to no homes. The setup card is
 * the only way forward, so it is blocked like any other create control.
 *
 * @component
 * @example
 * ```tsx
 * <HomesEmptyState onCreate={() => router.push("/homes/new")} />
 * ```
 */
export const HomesEmptyState = ({ onCreate }: HomesEmptyStateProps) => {
  // Passed as a prop: a color class on the icon does not apply on web.
  const color = useCSSVariable("--color-muted-foreground");

  return (
    <View className="gap-4">
      <Text className="text-center text-xl font-semibold">Let&apos;s create your first home</Text>
      <BlockedControl action="membership" label="Set up a home">
        {(disabled) => (
          <PressableSurface
            role="button"
            aria-label="Set up a home"
            disabled={disabled}
            className="items-center gap-2 rounded-lg border border-dashed border-border p-6"
            onPress={onCreate}
          >
            <Icon
              as={HousePlusIcon}
              size={32}
              color={typeof color === "string" ? color : undefined}
            />
            <Text className="text-lg font-semibold">Set up a home</Text>
            <Text className="text-center text-sm text-muted-foreground">
              A home holds your rooms, stock and the people you share it with.
            </Text>
          </PressableSurface>
        )}
      </BlockedControl>
    </View>
  );
};
