/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `eas.json` `preview` / `production` env blocks are baked into store builds,
// which never see the local `.env`. Two failure modes this suite guards:
//
//   1. A required var (Supabase) missing from a baked profile → the build
//      ships pointing at nothing, surfacing only as an opaque failure on a
//      real device.
//   2. Any env value set to "" → `eas build` rejects the whole file with
//      "not allowed to be empty" before it starts. Omit the key instead;
//      lib/env.ts and app.config.ts both treat absent as "not configured".

const appRoot = join(__dirname, "..");

const envExampleKeys = (() => {
  const text = readFileSync(join(appRoot, ".env.example"), "utf8");
  const keys = new Set<string>();
  for (const line of text.split("\n")) {
    const match = /^(EXPO_PUBLIC_[A-Z0-9_]+)=/.exec(line.trim());
    if (match) keys.add(match[1]);
  }
  return keys;
})();

const easBuild = (
  JSON.parse(readFileSync(join(appRoot, "eas.json"), "utf8")) as {
    build: Record<string, { env?: Record<string, string> }>;
  }
).build;

// Must be present with a real value in every baked profile — the app cannot
// reach the backend without them.
const REQUIRED_BAKED = {
  EXPO_PUBLIC_SUPABASE_URL: /^https:\/\/.+/,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: /^sb_publishable_.+/,
} as const;

const bakedProfiles = ["preview", "production"] as const;

describe("# eas.json config", () => {
  it("finds the EXPO_PUBLIC_* keys in the template", () => {
    // Guards the parser: zero keys would make the stray-key check vacuous.
    expect(envExampleKeys.size).toBeGreaterThan(0);
    expect(envExampleKeys).toContain("EXPO_PUBLIC_SUPABASE_URL");
  });

  it("has no empty-string env value in any profile", () => {
    // This is the exact shape `eas build` rejects up front.
    const offenders: string[] = [];
    for (const [profile, cfg] of Object.entries(easBuild)) {
      for (const [key, value] of Object.entries(cfg.env ?? {})) {
        if (value === "") offenders.push(`${profile}.env.${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  describe.each(bakedProfiles)("## %s profile", (profile) => {
    const env = easBuild[profile]?.env ?? {};

    it.each(Object.entries(REQUIRED_BAKED))("bakes a real %s", (key, pattern) => {
      expect(env[key]).toMatch(pattern);
    });

    it("carries no EXPO_PUBLIC_* key absent from .env.example", () => {
      // Optional keys (PostHog) may be omitted here until provisioned, but a
      // key baked into the build that the template never documents is drift.
      const stray = Object.keys(env).filter(
        (key) => key.startsWith("EXPO_PUBLIC_") && !envExampleKeys.has(key),
      );
      expect(stray).toEqual([]);
    });
  });

  it("leaves the Metro-served profiles without baked EXPO_PUBLIC_* keys", () => {
    // development / development-simulator are developmentClient builds that
    // load JS from Metro, which reads the local `.env`. Baking keys there too
    // would create a second source of truth that silently drifts.
    for (const profile of ["development", "development-simulator"]) {
      const env = easBuild[profile]?.env ?? {};
      const baked = Object.keys(env).filter((key) => key.startsWith("EXPO_PUBLIC_"));
      expect(baked).toEqual([]);
    }
  });
});
