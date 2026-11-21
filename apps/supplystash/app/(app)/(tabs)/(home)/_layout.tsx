import { Stack, useIsFocused } from "expo-router";
import { SharedTransitionBoundary } from "react-native-reanimated";

import { useIsOnline } from "@/hooks/use-is-online";
import { useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";

// Shared element transitions (the home card's cover growing into the details
// banner, components/home-cover.tsx) match tagged views between the boundary
// that goes inactive and the one that goes active. The boundary sits on this
// stack because its screens are the ones that share views; Reanimated wants it
// on the navigator that holds the screens, not on a layout of navigators.
const ScreenBoundary = ({ children }: { children: React.ReactNode }) => {
  const isFocused = useIsFocused();

  return <SharedTransitionBoundary isActive={isFocused}>{children}</SharedTransitionBoundary>;
};

const screenLayout = ({ children }: { children: React.ReactNode }) => (
  <ScreenBoundary>{children}</ScreenBoundary>
);

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
      screenLayout={screenLayout}
      screenOptions={{
        headerShown: false,
        unstable_nativeProps: { headerConfig: { disableTopInsetApplication: isBannerShown } },
      }}
    />
  );
}
