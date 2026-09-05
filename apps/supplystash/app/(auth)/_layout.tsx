import { Redirect, Stack } from "expo-router";

import { useSession } from "@/state/session";

export default function AuthLayout() {
  const { session, isLoading } = useSession();

  // Hold the tree until the persisted session has been read; redirecting on a
  // not-yet-loaded session would bounce a signed-in user through sign-in on every
  // cold start. The splash hold that makes this invisible is STASH-24.
  if (isLoading) {
    return null;
  }

  if (session) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
