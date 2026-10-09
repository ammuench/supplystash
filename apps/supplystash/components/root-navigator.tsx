import { Stack } from "expo-router";

import { useSession } from "@/state/session";

// Auth routing as declarative guards, so the stack mounts on the
// right group in its first render. The group layouts used to redirect after
// rendering, which showed as a visible hop from (app) to sign-in on cold start.
// Must render inside SessionProvider.
export const RootNavigator = () => {
  const { session, isLoading } = useSession();

  // With no session read yet, the guards would mount sign-in and then swap to
  // the tabs. SplashScreenController keeps the splash up over this null.
  if (isLoading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
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
