import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { restoreThemePreference } from "@/lib/theme-preference";
import { useSession } from "@/state/session";

// Owns the cold-start splash: hides it only once the app can paint its real
// first screen, i.e. the saved theme is applied (no wrong-theme flash) and the
// stored session has been read (the route layouts stop returning null). Renders
// nothing, and must sit inside SessionProvider.
//
// Neither signal can hang: restoreThemePreference never rejects, and
// SessionProvider settles `isLoading` even when the session read throws.
export const SplashScreenController = () => {
  const { isLoading } = useSession();
  const [isThemeRestored, setIsThemeRestored] = useState(false);

  useEffect(() => {
    void restoreThemePreference().finally(() => setIsThemeRestored(true));
  }, []);

  useEffect(() => {
    if (isThemeRestored && !isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isThemeRestored, isLoading]);

  return null;
};
