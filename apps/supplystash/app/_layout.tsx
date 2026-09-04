import "@/global.css";
import { Toasts } from "@backpackapp-io/react-native-toast";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { PostHogProvider } from "posthog-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUniwind, withUniwind } from "uniwind";

import { posthog } from "@/lib/analytics";
import { queryClient } from "@/lib/query-client";
import { NAV_THEME } from "@/lib/theme";
import { SessionProvider } from "@/state/session";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// `react-native-gesture-handler` is third-party, so it needs `withUniwind` to accept
// `className`. It has to be the outermost view and has to fill the screen — gorhom's
// bottom sheet reads its gestures through this root.
const StyledGestureHandlerRootView = withUniwind(GestureHandlerRootView);

// PostHog is absent when no key is configured (local dev), and PostHogProvider
// requires a client, so the tree renders unwrapped in that case rather than
// forcing every dev to hold an analytics key.
const AnalyticsProvider = ({ children }: { children: React.ReactNode }) =>
  posthog ? <PostHogProvider client={posthog}>{children}</PostHogProvider> : <>{children}</>;

export default function RootLayout() {
  const { theme } = useUniwind();

  return (
    <StyledGestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider value={NAV_THEME[theme ?? "light"]}>
            <QueryClientProvider client={queryClient}>
              {/* Inside QueryClientProvider: sign-out has to tear down the query
                  cache (STASH-21), so the client must already exist above it. */}
              <SessionProvider>
                <AnalyticsProvider>
                  <BottomSheetModalProvider>
                    <StatusBar style={theme === "dark" ? "light" : "dark"} />
                    <Stack />
                    <PortalHost />
                    {/* Toasts sit last so they render above the stack and the
                        portal host, and inside SafeAreaProvider so they respect
                        the notch. */}
                    <Toasts />
                  </BottomSheetModalProvider>
                </AnalyticsProvider>
              </SessionProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </StyledGestureHandlerRootView>
  );
}
