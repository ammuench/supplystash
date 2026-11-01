import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/offline-banner";
import { ServerUnreachableBar } from "@/components/server-unreachable-bar";
import { useIsOnline } from "@/hooks/use-is-online";
import { useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";

// Auth guarding happens in the root layout's RootNavigator (Stack.Protected).
// The banners sit above the stack, not over it, so they push every screen down
// instead of covering its top. At most one shows: offline wins over
// unreachable. See docs/connectivity.md.
export default function AppLayout() {
  const isOnline = useIsOnline();
  const isUnreachable = useIsServerUnreachable();
  const insets = useSafeAreaInsets();

  // A showing banner already pads for the status bar, so headers below must not
  // pad for it again. iOS's native bar measures its own position and needs
  // neither fix. Android's native header pads natively from the window, so it
  // needs `disableTopInsetApplication`. The zeroed context inset keeps the
  // stack's JS header-height math in line with that.
  const isBannerShown = !isOnline || isUnreachable;

  return (
    <View className="flex-1">
      <OfflineBanner />
      <ServerUnreachableBar />
      <SafeAreaInsetsContext.Provider value={isBannerShown ? { ...insets, top: 0 } : insets}>
        <Stack
          screenOptions={{
            headerShown: false,
            unstable_nativeProps: { headerConfig: { disableTopInsetApplication: isBannerShown } },
          }}
        />
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
