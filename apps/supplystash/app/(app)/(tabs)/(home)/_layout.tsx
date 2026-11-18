import { Stack } from "expo-router";

import { useIsOnline } from "@/hooks/use-is-online";
import { useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";

// The Home tab's own stack, so an opened home is pushed inside the tab and the
// tab bar stays. The other tabs are single screens and need none.
export default function HomeStackLayout() {
  const isOnline = useIsOnline();
  const isUnreachable = useIsServerUnreachable();

  // Same fix as app/(app)/_layout.tsx: a showing banner already pads for the
  // status bar, so Android's native header must not pad for it again. That
  // layout's zeroed inset context reaches this stack too; only the native
  // header option has to be repeated per stack.
  const isBannerShown = !isOnline || isUnreachable;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        unstable_nativeProps: { headerConfig: { disableTopInsetApplication: isBannerShown } },
      }}
    />
  );
}
