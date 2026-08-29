import "@/global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUniwind, withUniwind } from "uniwind";

import { NAV_THEME } from "@/lib/theme";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// `react-native-gesture-handler` is third-party, so it needs `withUniwind` to accept
// `className`. It has to be the outermost view and has to fill the screen — gorhom's
// bottom sheet reads its gestures through this root.
const StyledGestureHandlerRootView = withUniwind(GestureHandlerRootView);

export default function RootLayout() {
  const { theme } = useUniwind();

  return (
    <StyledGestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider value={NAV_THEME[theme ?? "light"]}>
            <BottomSheetModalProvider>
              <StatusBar style={theme === "dark" ? "light" : "dark"} />
              <Stack />
              <PortalHost />
            </BottomSheetModalProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </StyledGestureHandlerRootView>
  );
}
