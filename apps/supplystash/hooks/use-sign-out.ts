import { useRef, useState } from "react";

import { signOut } from "@/lib/auth";
import { countPausedMutations, queryClient } from "@/lib/query-client";
import { toastError, toastSuccess } from "@/lib/toast";

/**
 * The deliberate sign-out flow, for whatever renders the trigger. Sign-out
 * discards changes still queued offline, so it asks first:
 * `requestSignOut` signs out straight away when nothing is queued, and
 * otherwise sets `queuedToDiscard` for the caller's confirm dialog. The
 * involuntary path (an expired session) cannot ask; state/session.tsx reports
 * the loss instead.
 *
 * Nothing to do on success: `onAuthStateChange` clears the query cache and
 * wipes it from disk, and the `(app)` guard redirects to sign-in.
 */
export const useSignOut = () => {
  const [isSigningOut, setIsSigningOut] = useState(false);
  // Counted when sign-out is requested, so the dialog states the number the
  // user is agreeing to lose. Zero means no dialog.
  const [queuedToDiscard, setQueuedToDiscard] = useState(0);
  // A ref, not `isSigningOut`: two presses in one frame both read the state
  // from the same render, and would both sign out.
  const inFlight = useRef(false);

  const signOutNow = async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsSigningOut(true);
    try {
      const result = await signOut();
      if (result.ok) {
        toastSuccess("Signed out");
      } else {
        toastError(result.error.message);
      }
    } finally {
      inFlight.current = false;
      setIsSigningOut(false);
    }
  };

  const requestSignOut = () => {
    const queued = countPausedMutations(queryClient);
    if (queued > 0) {
      setQueuedToDiscard(queued);
      return;
    }
    void signOutNow();
  };

  const confirmSignOut = () => {
    setQueuedToDiscard(0);
    void signOutNow();
  };

  const cancelSignOut = () => setQueuedToDiscard(0);

  return { isSigningOut, queuedToDiscard, requestSignOut, confirmSignOut, cancelSignOut };
};
