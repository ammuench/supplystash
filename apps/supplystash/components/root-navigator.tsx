import { Stack } from "expo-router";

import { useIsQueryCacheClaimed } from "@/hooks/use-is-query-cache-claimed";
import { useIsQueryCacheRestored } from "@/lib/query-cache-restore";
import { useSession } from "@/state/session";

// Auth routing as declarative guards, so the stack mounts on the
// right group in its first render. The group layouts used to redirect after
// rendering, which showed as a visible hop from (app) to sign-in on cold start.
// Must render inside SessionProvider.
export const RootNavigator = () => {
  const { session, isLoading } = useSession();
  const isQueryCacheRestored = useIsQueryCacheRestored();
  const isQueryCacheClaimed = useIsQueryCacheClaimed(session?.user.id);

  // With no session read yet, the guards would mount sign-in and then swap to
  // the tabs. Until the read cache is restored, a screen could fetch and then
  // have its data overwritten by the restore pass. SplashScreenController
  // keeps the splash up over this null. Until the cache is claimed for this
  // user, it may hold another account's rows; on a sign-in this null lasts one
  // SQLite read, or a wipe when the account changed.
  if (isLoading || !isQueryCacheRestored || (session && !isQueryCacheClaimed)) {
    return null;
  }

  // No header here: each group runs its own stack, and a header at this level
  // shows the group's route name ("(app)") above everything, offline banner
  // included.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Explicit redirect: since SDK 58 a signed-out cold start on an (app)
          URL such as "/" shows Unmatched Route instead of falling through to
          the first allowed screen. */}
      <Stack.Protected guard={!!session} redirectTo="/sign-in">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Unguarded: the OAuth deep link lands here before a session exists. */}
      <Stack.Screen name="auth-callback" />
    </Stack>
  );
};
