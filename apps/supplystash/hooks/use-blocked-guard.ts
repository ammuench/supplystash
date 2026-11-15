import { useCallback } from "react";

import type { BlockedAction } from "@/lib/blocked-reason";

import { useBlockedReason } from "@/hooks/use-blocked-reason";
import { toastInfo } from "@/lib/toast";

/** Shows why an action is blocked. The id is the reason itself, so repeated
 * taps replace one toast instead of stacking a new one each time. Shared by
 * `BlockedControl` and `useBlockedGuard`, so both say the same thing.
 */
export const toastBlockedReason = (reason: string) => toastInfo(reason, `blocked:${reason}`);

/**
 * Guards a path to a server action that does not go through a
 * `BlockedControl`: a keyboard's Done key, a swipe, a deep link.
 * `BlockedControl` covers only the control it wraps, so any other way of
 * starting the same action must go through this.
 *
 * `guard(run)` calls `run` when `action` is allowed. When it is blocked, it
 * shows the reason as a toast and does not call `run`. See
 * docs/connectivity.md.
 *
 * @example
 * ```tsx
 * const guard = useBlockedGuard("membership");
 * const submit = () => guard(() => void form.handleSubmit());
 * ```
 */
export const useBlockedGuard = (action: BlockedAction) => {
  const state = useBlockedReason(action);
  const reason = state.blocked ? state.reason : null;

  return useCallback(
    (run: () => void) => {
      if (reason !== null) {
        toastBlockedReason(reason);

        return;
      }

      run();
    },
    [reason],
  );
};
