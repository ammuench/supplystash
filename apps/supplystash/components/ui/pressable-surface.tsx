import * as React from "react";
import { Platform, Pressable } from "react-native";

import { cn } from "@/lib/utils";

export type PressableSurfaceProps = React.ComponentProps<typeof Pressable> & {
  className?: string;
};

/**
 * A `Pressable` with the app's standard touch feedback, for surfaces that are
 * not buttons: cards, list rows, tiles. Use it instead of a bare `Pressable`
 * so every tappable surface responds the same way.
 *
 * It adds only the feedback: an `accent` wash while pressed, and on hover on
 * web. Border, radius, padding and layout stay with the caller, through
 * `className`.
 *
 * The wash matches the ghost and outline variants in `button.tsx`. Change the
 * two together.
 *
 * @component
 * @example
 * ```tsx
 * <PressableSurface role="link" className="rounded-lg border border-border p-4" onPress={open}>
 *   <Text>Lake House</Text>
 * </PressableSurface>
 * ```
 */
export const PressableSurface = ({ className, ...props }: PressableSurfaceProps) => (
  <Pressable
    className={cn(
      "active:bg-accent dark:active:bg-accent/50",
      Platform.select({ web: "hover:bg-accent dark:hover:bg-accent/50" }),
      className,
    )}
    {...props}
  />
);
