import type { ToastOptions } from "@backpackapp-io/react-native-toast";

import { ToastPosition, toast } from "@backpackapp-io/react-native-toast";
import { View } from "react-native";

import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { cn } from "@/lib/utils";

// Call sites use these instead of importing the toast library, so the library
// can be swapped and so every toast carries the matching haptic without each
// caller remembering to fire one.

// Bottom by default: the top of the screen is the notch/status-bar area and
// the header, and a toast there covers navigation the user may be reaching for.
const DEFAULT_POSITION: ToastOptions = { position: ToastPosition.BOTTOM };

// Info matches success (2s) rather than the library's 4s for plain toasts.
// Warn matches error (4s), since it is worth reading in full.
const INFO_DURATION_MS = 2000;
const WARN_DURATION_MS = 4000;

// The library draws its colored bar only for success and error, in fixed colors
// that ignore the theme. So every state hides that bar and passes this themed
// copy as the icon instead. Same 3px bar and spacing as the library's.
const Indicator = ({ className }: { className: string }) => (
  <View className={cn("mr-3 h-full w-[3px] rounded-full", className)} />
);

const HIDE_LIBRARY_BAR: ToastOptions["styles"] = { indicator: { display: "none" } };

const SUCCESS_STYLE: ToastOptions = {
  styles: HIDE_LIBRARY_BAR,
  icon: <Indicator className="bg-success" />,
};

const ERROR_STYLE: ToastOptions = {
  styles: HIDE_LIBRARY_BAR,
  icon: <Indicator className="bg-destructive" />,
};

export const toastSuccess = (message: string) => {
  void hapticSuccess();
  return toast.success(message, { ...DEFAULT_POSITION, ...SUCCESS_STYLE });
};

export const toastError = (message: string) => {
  void hapticError();
  return toast.error(message, { ...DEFAULT_POSITION, ...ERROR_STYLE });
};

/** `id` makes repeat calls replace the toast on screen instead of stacking. */
export const toastInfo = (message: string, id?: string) =>
  toast(message, {
    ...DEFAULT_POSITION,
    id,
    duration: INFO_DURATION_MS,
    icon: <Indicator className="bg-info" />,
  });

/** `id` makes repeat calls replace the toast on screen instead of stacking. */
export const toastWarn = (message: string, id?: string) => {
  void hapticWarning();
  return toast(message, {
    ...DEFAULT_POSITION,
    id,
    duration: WARN_DURATION_MS,
    icon: <Indicator className="bg-warning" />,
  });
};

/**
 * Tie a toast to a promise: spinner while pending, then success or error. Use
 * for mutations where the user is waiting on the network.
 */
export const toastPromise = <T,>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string },
) =>
  toast.promise(promise, messages, {
    ...DEFAULT_POSITION,
    success: SUCCESS_STYLE,
    error: ERROR_STYLE,
  });

export const dismissToast = (id?: string) => toast.dismiss(id);
