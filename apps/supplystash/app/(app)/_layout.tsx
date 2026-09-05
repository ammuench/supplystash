import { Redirect, Stack } from "expo-router";

import { useSession } from "@/state/session";

export default function AppLayout() {
  const { session, isLoading } = useSession();

  // See the note in `(auth)/_layout.tsx`: no routing decision until the stored
  // session has been read off disk.
  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
