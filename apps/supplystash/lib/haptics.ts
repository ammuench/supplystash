import * as Haptics from "expo-haptics";

// Every haptic goes through here so the app has one vocabulary for feedback
// rather than scattered ImpactFeedbackStyle picks. Haptics are unavailable on
// web and on some Android hardware, and the native calls reject rather than
// no-op there, so each helper swallows the failure — feedback is never load
// bearing.
const safely = async (run: () => Promise<void>) => {
  try {
    await run();
  } catch {
    // Ignored: haptics are decorative.
  }
};

/** A tap landed — selecting an item, toggling a switch. */
export const hapticSelection = () => safely(() => Haptics.selectionAsync());

/** A deliberate action committed — saving, adding to inventory. */
export const hapticImpact = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** An action succeeded. Pair with a success toast, never on its own. */
export const hapticSuccess = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** An action failed. Pair with an error toast. */
export const hapticError = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
