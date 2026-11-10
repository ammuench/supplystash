import { Toasts } from "@backpackapp-io/react-native-toast";
import { useSegments } from "expo-router";

import { TAB_BAR_HEIGHT } from "@/lib/tab-bar";

const ABOVE_TAB_BAR = { bottom: TAB_BAR_HEIGHT };

// The toast host is mounted once at the root, above every screen, so it does
// not know a tab bar is in the way. On tab screens bottom toasts are lifted by
// the bar's height. The library already adds the bottom safe-area inset. Pushed
// screens and the auth screens have no bar, so toasts sit at the bottom there.
export const AppToasts = () => {
  const segments: string[] = useSegments();
  const isTabBarShown = segments.includes("(tabs)");

  return <Toasts extraInsets={isTabBarShown ? ABOVE_TAB_BAR : undefined} />;
};
