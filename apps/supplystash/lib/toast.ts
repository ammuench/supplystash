import type { ToastOptions } from "@backpackapp-io/react-native-toast";

import { ToastPosition, toast } from "@backpackapp-io/react-native-toast";

import { hapticError, hapticSuccess } from "@/lib/haptics";

// Call sites use these instead of importing the toast library, so the library
// can be swapped and so every toast carries the matching haptic without each
// caller remembering to fire one.

// Bottom by default: the top of the screen is the notch/status-bar area and
// the header, and a toast there covers navigation the user may be reaching for.
const DEFAULT_POSITION: ToastOptions = { position: ToastPosition.BOTTOM };

export const toastSuccess = (message: string) => {
  void hapticSuccess();
  return toast.success(message, DEFAULT_POSITION);
};

export const toastError = (message: string) => {
  void hapticError();
  return toast.error(message, DEFAULT_POSITION);
};

export const toastInfo = (message: string) => toast(message, DEFAULT_POSITION);

/**
 * Tie a toast to a promise: spinner while pending, then success or error. Use
 * for mutations where the user is waiting on the network.
 */
export const toastPromise = <T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string },
) => toast.promise(promise, messages, DEFAULT_POSITION);

export const dismissToast = (id?: string) => toast.dismiss(id);
