import { Stack } from "expo-router";
import { View } from "react-native";

import { OfflineBanner } from "@/components/offline-banner";
import { ServerUnreachableBar } from "@/components/server-unreachable-bar";

// Auth guarding happens in the root layout's RootNavigator (Stack.Protected).
// The banners sit above the stack, not over it, so they push every screen down
// instead of covering its top. At most one shows: offline wins over
// unreachable. See docs/connectivity.md.
export default function AppLayout() {
  return (
    <View className="flex-1">
      <OfflineBanner />
      <ServerUnreachableBar />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
