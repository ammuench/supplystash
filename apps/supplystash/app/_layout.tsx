import "@/global.css";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

import { NAV_THEME } from "@/lib/theme";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export default function RootLayout() {
  const { theme } = useUniwind();

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider value={NAV_THEME[theme ?? "light"]}>
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
          <Stack />
          <PortalHost />
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
