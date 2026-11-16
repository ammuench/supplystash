import {
  COVER_HUE_STEP,
  deriveCoverColor,
  getHomeCoverKey,
  HOME_COVER_KEYS,
  parseColor,
} from "@/lib/home-cover";

// The real `--color-info` values from global.css.
const LIGHT_INFO = "oklch(54.6% 0.245 262.881)";
const DARK_INFO = "oklch(80.9% 0.105 251.813)";

describe("# home cover", () => {
  describe("## getHomeCoverKey", () => {
    it("gives the same key for the same id every time", () => {
      const id = "6f1c2d3e-0000-4000-8000-123456789abc";

      expect(getHomeCoverKey(id)).toBe(getHomeCoverKey(id));
    });

    it("always gives a key from the list", () => {
      for (let i = 0; i < 50; i++) {
        expect(HOME_COVER_KEYS).toContain(getHomeCoverKey(`home-${i}`));
      }
    });

    it("spreads ids over more than one key", () => {
      const keys = new Set(Array.from({ length: 20 }, (_, i) => getHomeCoverKey(`home-${i}`)));

      expect(keys.size).toBeGreaterThan(1);
    });
  });

  describe("## parseColor", () => {
    it("reads the light and dark info tokens as written on web", () => {
      expect(parseColor(LIGHT_INFO)).toEqual({ l: 0.546, c: 0.245, h: 262.881 });
      expect(parseColor(DARK_INFO)).toEqual({ l: 0.809, c: 0.105, h: 251.813 });
    });

    it("reads hex, which is what native hands over", () => {
      const white = parseColor("#ffffff");

      expect(white?.l).toBeCloseTo(1, 3);
      expect(white?.c).toBeCloseTo(0, 3);
    });

    it("returns null for anything else", () => {
      expect(parseColor(undefined)).toBeNull();
      expect(parseColor("")).toBeNull();
      expect(parseColor("rgb(0 0 0)")).toBeNull();
      expect(parseColor("oklch(nope)")).toBeNull();
    });
  });

  describe("## deriveCoverColor", () => {
    const base = parseColor(LIGHT_INFO)!;

    it("returns a hex colour for every key", () => {
      for (const key of HOME_COVER_KEYS) {
        expect(deriveCoverColor(base, key)).toMatch(/^#[\da-f]{6}$/);
      }
    });

    it("gives each key a different colour", () => {
      const colors = new Set(HOME_COVER_KEYS.map((key) => deriveCoverColor(base, key)));

      expect(colors.size).toBe(HOME_COVER_KEYS.length);
    });

    it("keeps the base lightness and turns only the hue", () => {
      const derived = parseColor(deriveCoverColor(base, 1))!;

      // Loose: the hex round trip and sRGB clamping move the values a little.
      expect(derived.l).toBeCloseTo(base.l, 1);
      expect(Math.abs(derived.h - ((base.h + COVER_HUE_STEP) % 360))).toBeLessThan(10);
    });

    it("wraps the hue past 360", () => {
      // 262.881 + 2 × 60 is past 360.
      const derived = parseColor(deriveCoverColor(base, 2))!;

      expect(derived.h).toBeLessThan(360);
      expect(Math.abs(derived.h - ((base.h + 2 * COVER_HUE_STEP) % 360))).toBeLessThan(10);
    });

    it("gives key 0 back as the base colour", () => {
      // A hex base survives the round trip exactly.
      expect(deriveCoverColor(parseColor("#3366cc")!, 0)).toBe("#3366cc");
    });
  });
});
