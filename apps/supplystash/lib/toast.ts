import { toast } from "@backpackapp-io/react-native-toast";

import { hapticError, hapticSuccess } from "@/lib/haptics";

// Call sites use these instead of importing the toast library, so the library
// can be swapped and so every toast carries the matching haptic without each
// caller remembering to fire one.

export const toastSuccess = (message: string) => {
  void hapticSuccess();
  return toast.success(message);
};

export const toastError = (message: string) => {
  void hapticError();
  return toast.error(message);
};

export const toastInfo = (message: string) => toast(message);

/**
 * Tie a toast to a promise: spinner while pending, then success or error. Use
 * for mutations where the user is waiting on the network.
 */
export const toastPromise = <T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string },
) => toast.promise(promise, messages);

export const dismissToast = (id?: string) => toast.dismiss(id);
