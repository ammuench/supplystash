import { Stack } from "expo-router";

// Auth guarding happens in the root layout's RootNavigator (Stack.Protected).
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
