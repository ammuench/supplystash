/**
 * Cover colours for home cards, derived from one theme token so they follow
 * any change to the theme (light, dark or a new palette) with no extra tokens.
 *
 * ## How to change the covers
 *
 * - Retint every cover: point `COVER_BASE_TOKEN` at another colour token. Its
 *   lightness and chroma are kept; only the hue turns.
 * - Spread or shift the hues: `COVER_HUE_STEP` is the gap between covers,
 *   `COVER_HUE_OFFSET` moves them all (raise it if a cover looks too close to
 *   the blue "In stock" pill, which uses the same base token).
 * - Softer or stronger wash: `COVER_LIGHTNESS_SHIFT` (0–1 oklch lightness,
 *   added) and `COVER_CHROMA_SCALE` (multiplied).
 * - More or fewer covers: change `HOME_COVER_KEYS`. Existing homes then move
 *   to a new colour, since the pick is the id hash modulo the list length.
 * - Fixed, designer-picked colours (STASH-65 may want this): add
 *   `--color-cover-*` tokens and change only `deriveCoverColor`; the keys and
 *   `getHomeCoverKey` stay as they are.
 */

export const COVER_BASE_TOKEN = "--color-info";
export const COVER_HUE_STEP = 60;
export const COVER_HUE_OFFSET = 0;
export const COVER_LIGHTNESS_SHIFT = 0;
export const COVER_CHROMA_SCALE = 1;

/** The cover slots. STASH-65 stores one of these as a home's chosen colour. */
export const HOME_COVER_KEYS = [0, 1, 2, 3, 4, 5] as const;

export type HomeCoverKey = (typeof HOME_COVER_KEYS)[number];

export type Oklch = { l: number; c: number; h: number };

/** Picks a cover from the home's id, so a home has the same colour on every device. */
export const getHomeCoverKey = (homeId: string): HomeCoverKey => {
  // djb2: stable across platforms and runs, which is all this needs.
  let hash = 5381;
  for (let i = 0; i < homeId.length; i++) {
    hash = ((hash << 5) + hash + homeId.charCodeAt(i)) | 0;
  }

  return HOME_COVER_KEYS[Math.abs(hash) % HOME_COVER_KEYS.length];
};

// sRGB <-> OKLab, after Björn Ottosson (https://bottosson.github.io/posts/oklab/).
// Hand-written rather than a dependency: these two functions are all we need.
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

const rgbToOklch = (r: number, g: number, b: number): Oklch => {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;

  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
};

const oklchToHex = ({ l: L, c, h }: Oklch): string => {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad);
  const B = c * Math.sin(rad);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  // A rotated hue can fall outside sRGB; clamping is close enough for a wash.
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

/**
 * Reads a token value as uniwind hands it over: `oklch(L% C H)` on web (the
 * CSS as written), `#rrggbb` on native (uniwind converts colours at build
 * time). Anything else returns `null`.
 */
export const parseColor = (value: string | undefined): Oklch | null => {
  if (!value) return null;
  const trimmed = value.trim();

  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(trimmed);
  if (oklch) {
    const l = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    return { l, c: Number(oklch[3]), h: Number(oklch[4]) };
  }

  const hex = /^#([\da-f]{6})([\da-f]{2})?$/i.exec(trimmed);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return rgbToOklch(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  return null;
};

/** The cover colour for `key`, as `#rrggbb` (native styles do not take oklch). */
export const deriveCoverColor = (base: Oklch, key: HomeCoverKey): string =>
  oklchToHex({
    l: Math.min(1, Math.max(0, base.l + COVER_LIGHTNESS_SHIFT)),
    c: base.c * COVER_CHROMA_SCALE,
    h: (((base.h + COVER_HUE_OFFSET + key * COVER_HUE_STEP) % 360) + 360) % 360,
  });
