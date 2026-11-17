import { useCSSVariable } from "uniwind";

import { COVER_BASE_TOKEN, deriveCoverColor, getHomeCoverKey, parseColor } from "@/lib/home-cover";

/**
 * The cover colour for a home, re-derived when the theme changes. `undefined`
 * if the base token cannot be read; the caller then keeps a token class
 * (`bg-muted`) as its fallback. See lib/home-cover.ts to change the covers.
 */
export const useHomeCoverColor = (homeId: string): string | undefined => {
  const value = useCSSVariable(COVER_BASE_TOKEN);
  const base = parseColor(typeof value === "string" ? value : undefined);

  return base ? deriveCoverColor(base, getHomeCoverKey(homeId)) : undefined;
};
