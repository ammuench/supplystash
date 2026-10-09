import AsyncStorage from "@react-native-async-storage/async-storage";
import { Uniwind, useUniwind } from "uniwind";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme-preference";

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

// Called once from app/_layout.tsx before the splash hides, so the saved theme
// is applied before the first visible frame. Never rejects: an unreadable or
// unknown value falls back to following the OS rather than holding the splash.
export const restoreThemePreference = async () => {
  let preference: ThemePreference = "system";
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) {
      preference = stored;
    }
  } catch {
    // Fall through to "system".
  }
  Uniwind.setTheme(preference);
};

// Uniwind is the source of truth, so there is no separate store to keep in
// sync: `hasAdaptiveThemes` is true exactly when the app follows the OS.
export const useThemePreference = () => {
  const { theme, hasAdaptiveThemes } = useUniwind();
  const preference: ThemePreference = hasAdaptiveThemes
    ? "system"
    : (theme as Exclude<ThemePreference, "system">);

  const setPreference = async (next: ThemePreference) => {
    // Apply first so the switch is instant. A failed write only costs
    // persistence across restarts; the theme stays applied for this session.
    Uniwind.setTheme(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // See above.
    }
  };

  return { preference, setPreference };
};
