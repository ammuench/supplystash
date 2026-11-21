import { View } from "react-native";

import type { Home } from "@/state/homes";

import { Text } from "@/components/ui/text";
import { useHomeCoverColor } from "@/hooks/use-home-cover-color";
import { cn } from "@/lib/utils";

/**
 * A home's cover: a colour wash with the home's first letter. No image yet;
 * the colour comes from the home's id (lib/home-cover.ts), so it is the same on
 * every device. Size and corners come from `className`.
 *
 * @component
 * @example
 * ```tsx
 * <HomeCover home={home} className="h-24 rounded-md" />
 * ```
 */
export const HomeCover = ({
  home,
  className,
  children,
}: {
  home: Home;
  className?: string;
  /** Laid over the cover, such as the stat pills. */
  children?: React.ReactNode;
}) => {
  const backgroundColor = useHomeCoverColor(home.id);

  return (
    <View
      // `bg-muted` shows only if the cover colour could not be derived.
      className={cn("items-center justify-center bg-muted", className)}
      style={[{ borderCurve: "continuous" }, backgroundColor ? { backgroundColor } : null]}
    >
      <Text className="text-4xl font-bold text-foreground">
        {home.name.trim().charAt(0).toUpperCase()}
      </Text>
      {children}
    </View>
  );
};
