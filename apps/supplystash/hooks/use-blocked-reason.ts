import { Platform } from "react-native";

import { useIsOnline } from "@/hooks/use-is-online";
import { useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";
import { type BlockedAction, getBlockedReason } from "@/lib/blocked-reason";

/** Whether `action` is blocked right now, and why. Re-renders when the
 * connection drops, returns, or the server stops answering. See
 * docs/connectivity.md.
 */
export const useBlockedReason = (action: BlockedAction) => {
  const isOnline = useIsOnline();
  const isUnreachable = useIsServerUnreachable();

  return getBlockedReason(action, { isOnline, isUnreachable, isWeb: Platform.OS === "web" });
};
