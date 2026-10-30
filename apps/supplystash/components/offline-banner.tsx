import { WifiOffIcon } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useIsOnline } from "@/hooks/use-is-online";
import { useOldestPersistedUpdatedAt } from "@/hooks/use-oldest-persisted-updated-at";
import { formatRelativeMillis } from "@/lib/dates";

// Past this, the offline banner names how old the cached data is (§5.6).
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

const NATIVE_COPY = "Offline — changes will sync when the connection is reestablished.";
// Web has no paused-mutation persistence, so writes are disabled rather than
// queued, and no age: memory-only data is never older than the session.
const WEB_COPY = "Offline — you can't change values until the connection is reestablished.";

/**
 * Top strip shown only while offline. Mounted once in `app/(app)/_layout.tsx`
 * above the stack, so it pushes every screen down instead of covering it. It
 * pads the top inset itself; the screens' `SafeAreaView` then sees no overlap
 * and adds none. See docs/connectivity.md.
 */
export const OfflineBanner = () => {
  const isOnline = useIsOnline();
  const oldest = useOldestPersistedUpdatedAt();
  const { top } = useSafeAreaInsets();

  if (isOnline) {
    return null;
  }

  const isWeb = Platform.OS === "web";
  const isStale = !isWeb && oldest !== null && Date.now() - oldest > STALE_AFTER_MS;
  const message = isWeb
    ? WEB_COPY
    : isStale
      ? `${NATIVE_COPY} Last updated ${formatRelativeMillis(oldest)}.`
      : NATIVE_COPY;

  return (
    // `accessible` makes the strip one element, so screen readers read the
    // whole message once instead of the icon and text separately.
    <View
      accessible
      role="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2 border-b border-border bg-card px-4 pb-2"
      style={{ paddingTop: top + 8 }}
    >
      <Icon as={WifiOffIcon} className="size-4 text-warning" />
      <Text className="flex-1 text-sm text-card-foreground">{message}</Text>
    </View>
  );
};
