import { useIsRestoring } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { useIsQueryCacheClaimed } from "@/hooks/use-is-query-cache-claimed";
import { useIsQueryCacheRestored } from "@/lib/query-cache-restore";
import { restoreThemePreference } from "@/lib/theme-preference";
import { useSession } from "@/state/session";

// Owns the cold-start splash: hides it only once the app can paint its real
// first screen, i.e. the saved theme is applied (no wrong-theme flash), the
// stored session has been read, the read cache restored and claimed for that
// user (RootNavigator stops returning null), and the paused-mutation queue is
// restored. Renders
// nothing, and must sit inside SessionProvider and QueryProvider.
//
// No signal can hang: restoreThemePreference and the read-cache pass never
// reject, SessionProvider settles `isLoading` even when the session read
// throws, and PersistQueryClientProvider clears `useIsRestoring()` on a failed
// restore too.
export const SplashScreenController = () => {
  const { session, isLoading } = useSession();
  const isQueryCacheRestored = useIsQueryCacheRestored();
  const isQueryCacheClaimed = useIsQueryCacheClaimed(session?.user.id);
  const isRestoringMutations = useIsRestoring();
  const [isThemeRestored, setIsThemeRestored] = useState(false);

  useEffect(() => {
    void restoreThemePreference().finally(() => setIsThemeRestored(true));
  }, []);

  const isReady =
    isThemeRestored &&
    !isLoading &&
    isQueryCacheRestored &&
    !isRestoringMutations &&
    (!session || isQueryCacheClaimed);
  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  return null;
};
