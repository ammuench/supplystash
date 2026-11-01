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
// Tap dismisses instead of swipe: the library only flings a bottom toast down,
// and on iOS that collides with the home-indicator system gesture.
const DEFAULT_OPTIONS: ToastOptions = {
  position: ToastPosition.BOTTOM,
  isSwipeable: false,
  onPress: (shown) => toast.dismiss(shown.id),
};

// The library announces a toast to screen readers only when this is set (its
// spelling); the toast view itself is not a live region.
const announce = (message: string): ToastOptions => ({ accessabilityMessage: message });

// Info and warn match error (4s): long messages like the session-expiry notice
// need time to read, and a tap dismisses any toast sooner.
const INFO_DURATION_MS = 4000;
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
  return toast.success(message, {
    ...DEFAULT_OPTIONS,
    ...SUCCESS_STYLE,
    ...announce(message),
  });
};

export const toastError = (message: string) => {
  void hapticError();
  return toast.error(message, {
    ...DEFAULT_OPTIONS,
    ...ERROR_STYLE,
    ...announce(message),
  });
};

/** `id` makes repeat calls replace the toast on screen instead of stacking. */
export const toastInfo = (message: string, id?: string) =>
  toast(message, {
    ...DEFAULT_OPTIONS,
    ...announce(message),
    id,
    duration: INFO_DURATION_MS,
    icon: <Indicator className="bg-info" />,
  });

/** `id` makes repeat calls replace the toast on screen instead of stacking. */
export const toastWarn = (message: string, id?: string) => {
  void hapticWarning();
  return toast(message, {
    ...DEFAULT_OPTIONS,
    ...announce(message),
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
    ...DEFAULT_OPTIONS,
    success: SUCCESS_STYLE,
    error: ERROR_STYLE,
  });

export const dismissToast = (id?: string) => toast.dismiss(id);
