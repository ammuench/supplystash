import type { ColorValue } from "react-native";

import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";
import { useMemo } from "react";
import { useCSSVariable, useUniwind } from "uniwind";

// React Navigation ignores className and colors the screen background, header,
// and tab bar from the ThemeProvider object instead. This hook translates the
// global.css tokens into that object, so global.css stays the only source of
// color values.
export const useNavTheme = (): Theme => {
  const { theme } = useUniwind();
  const [background, border, card, notification, primary, text] = useCSSVariable([
    "--color-background",
    "--color-border",
    "--color-card",
    "--color-destructive",
    "--color-primary",
    "--color-foreground",
  ]);

  return useMemo(() => {
    const base = theme === "dark" ? DarkTheme : DefaultTheme;
    // `useCSSVariable` yields undefined for a missing token (and numbers for
    // non-color tokens), so keep React Navigation's own color in that case.
    const pick = (value: string | number | undefined, fallback: ColorValue) =>
      typeof value === "string" ? value : fallback;

    return {
      ...base,
      colors: {
        background: pick(background, base.colors.background),
        border: pick(border, base.colors.border),
        card: pick(card, base.colors.card),
        notification: pick(notification, base.colors.notification),
        primary: pick(primary, base.colors.primary),
        text: pick(text, base.colors.text),
      },
    };
  }, [theme, background, border, card, notification, primary, text]);
};
