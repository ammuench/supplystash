/** Actions that need the server. Callers name what they are doing; the
 * matrix below decides whether and why it is blocked right now.
 */
export type BlockedAction =
  | "ledger-write"
  | "membership"
  | "barcode"
  | "photo"
  | "history"
  | "check-off";

export type BlockedReason = { blocked: false } | { blocked: true; reason: string };

export type ConnectionState = {
  isOnline: boolean;
  isUnreachable: boolean;
  isWeb: boolean;
};

const OFFLINE_COPY = "You're offline. This needs a connection.";
const OFFLINE_WEB_CHECK_OFF_COPY =
  "You're offline. On the web, checking items off needs a connection.";
const UNREACHABLE_COPY = "Can't reach the server right now. Try again once it's back.";

const NOT_BLOCKED: BlockedReason = { blocked: false };

/** Whether `action` is blocked, and the reason to show (architecture §5.1:
 * refusals are pre-emptive, never attempted-then-refused). Offline blocks
 * everything except the native check-off, which queues and replays on
 * reconnect. Web persists nothing, so its check-off would vanish on refresh.
 * Unreachable blocks everything, check-off included: the app is online, so a
 * write would fire and fail. Offline wins, as it does for the top strips. See
 * docs/connectivity.md.
 */
export const getBlockedReason = (
  action: BlockedAction,
  { isOnline, isUnreachable, isWeb }: ConnectionState,
): BlockedReason => {
  if (!isOnline) {
    if (action !== "check-off") {
      return { blocked: true, reason: OFFLINE_COPY };
    }

    return isWeb ? { blocked: true, reason: OFFLINE_WEB_CHECK_OFF_COPY } : NOT_BLOCKED;
  }

  return isUnreachable ? { blocked: true, reason: UNREACHABLE_COPY } : NOT_BLOCKED;
};
