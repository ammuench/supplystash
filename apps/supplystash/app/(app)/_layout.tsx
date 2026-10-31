import { Stack } from "expo-router";
import { View } from "react-native";

import { OfflineBanner } from "@/components/offline-banner";

// Auth guarding happens in the root layout's RootNavigator (Stack.Protected).
// The banner sits above the stack, not over it, so going offline pushes every
// screen down instead of covering its top. See docs/connectivity.md.
export default function AppLayout() {
  return (
    <View className="flex-1">
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
