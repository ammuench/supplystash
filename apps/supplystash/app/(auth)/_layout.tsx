import { Stack } from "expo-router";

// When RootNavigator's guard sends a signed-out user here, the group opens on
// its initial route; pin it rather than rely on file ordering.
export const unstable_settings = {
  initialRouteName: "sign-in",
};

// Auth guarding happens in the root layout's RootNavigator (Stack.Protected).
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
