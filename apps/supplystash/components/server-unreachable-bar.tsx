import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { ServerOffIcon } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useIsOnline } from "@/hooks/use-is-online";
import { isUnreachableQuery, useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";
import { useOldestPersistedUpdatedAt } from "@/hooks/use-oldest-persisted-updated-at";

const SAVED_COPY = "Can't reach the server — showing your last saved list.";
// A fresh install has no saved list to fall back on.
const EMPTY_COPY = "Can't reach the server.";

/**
 * Top strip shown while online but a persisted query cannot reach the server:
 * a captive portal, or Supabase down. Same placement as `OfflineBanner`,
 * mounted right after it in `app/(app)/_layout.tsx`. Offline wins: going
 * offline pauses queries without clearing their last error, so both could
 * otherwise show at once. See docs/connectivity.md.
 */
export const ServerUnreachableBar = () => {
  const client = useQueryClient();
  const isOnline = useIsOnline();
  const isUnreachable = useIsServerUnreachable();
  const oldest = useOldestPersistedUpdatedAt();
  // Also counts refetches started by focus or reconnect, not only Retry.
  const isRetrying = useIsFetching({ predicate: isUnreachableQuery }) > 0;
  const { top } = useSafeAreaInsets();

  if (!isOnline || !isUnreachable) {
    return null;
  }

  return (
    <View
      className="flex-row items-center gap-2 border-b border-border bg-card px-4 pb-2"
      style={{ paddingTop: top + 8 }}
    >
      {/* Not on the strip itself: an `accessible` parent hides its children
          from screen readers, and Retry must stay reachable. */}
      <View
        accessible
        role="alert"
        accessibilityLiveRegion="polite"
        className="flex-1 flex-row items-center gap-2"
      >
        <Icon as={ServerOffIcon} className="size-4 text-warning" />
        <Text className="flex-1 text-sm text-card-foreground">
          {oldest === null ? EMPTY_COPY : SAVED_COPY}
        </Text>
      </View>
      <Button
        variant="outline"
        size="sm"
        disabled={isRetrying}
        onPress={() => void client.refetchQueries({ predicate: isUnreachableQuery })}
      >
        <Text>{isRetrying ? "Retrying…" : "Retry"}</Text>
      </Button>
    </View>
  );
};
