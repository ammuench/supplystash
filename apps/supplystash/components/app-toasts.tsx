import { Toasts } from "@backpackapp-io/react-native-toast";
import { useSegments } from "expo-router";
import { useMemo } from "react";
import { useCSSVariable } from "uniwind";

import { TAB_BAR_HEIGHT } from "@/lib/tab-bar";

const ABOVE_TAB_BAR = { bottom: TAB_BAR_HEIGHT };

// The library colors a toast from two fixed colors of its own, picked by the
// operating system's light/dark setting and inverted against it. That ignores
// both the palette and the in-app theme picker. This hook swaps in the popover
// tokens, the same surface as cards and the tab bar, so the state color bars in
// lib/toast.tsx sit on the surface they were tuned for.
const useToastStyle = () => {
  const [surface, text, border] = useCSSVariable([
    "--color-popover",
    "--color-popover-foreground",
    "--color-border",
  ]);

  return useMemo(() => {
    // `useCSSVariable` yields undefined for a missing token; leaving a key out
    // keeps the library's own color in that case.
    const color = (value: string | number | undefined) =>
      typeof value === "string" ? value : undefined;

    return {
      // The library puts the background on the pressable, not the inner view.
      pressable: {
        backgroundColor: color(surface),
        borderColor: color(border),
        borderWidth: 1,
      },
      text: { color: color(text) },
    };
  }, [surface, text, border]);
};

// The toast host is mounted once at the root, above every screen, so it does
// not know a tab bar is in the way. On tab screens bottom toasts are lifted by
// the bar's height. The library already adds the bottom safe-area inset. Pushed
// screens and the auth screens have no bar, so toasts sit at the bottom there.
export const AppToasts = () => {
  const segments: string[] = useSegments();
  const isTabBarShown = segments.includes("(tabs)");
  const defaultStyle = useToastStyle();

  return (
    <Toasts defaultStyle={defaultStyle} extraInsets={isTabBarShown ? ABOVE_TAB_BAR : undefined} />
  );
};
