/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `eas.json` env blocks are baked into the binary at build time, and EAS never
// sees the local `.env` (it is gitignored, so it never uploads). Three failure
// modes this suite guards:
//
//   1. A required var (Supabase) missing from a store profile → the build
//      ships pointing at nothing, surfacing only as an opaque failure on a
//      real device.
//   2. Any env value set to "" → `eas build` rejects the whole file with
//      "not allowed to be empty" before it starts. Omit the key instead;
//      lib/env.ts and app.config.ts both treat absent as "not configured".
//   3. A key baked into any profile that `.env.example` never documents →
//      drift between the two places a var has to be declared.
//
// On the dev profiles: they carry the required keys too. Both are
// developmentClient builds, so whenever Metro is connected it serves the
// manifest it evaluated from the local `.env` and these values are never
// consulted. They exist for the other launch path — opening the installed
// internal build with no dev server, where the embedded manifest is all there
// is and an empty `extra` throws in lib/env.ts on launch.

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

// Must be present with a real value in every store profile — the app cannot
// reach the backend without them.
const REQUIRED_BAKED = {
  EXPO_PUBLIC_SUPABASE_URL: /^https:\/\/.+/,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: /^sb_publishable_.+/,
} as const;

const storeProfiles = ["preview", "production"] as const;
const devProfiles = ["development", "development-simulator"] as const;
const allProfiles = [...storeProfiles, ...devProfiles] as const;

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

  describe.each(storeProfiles)("## %s profile", (profile) => {
    const env = easBuild[profile]?.env ?? {};

    it.each(Object.entries(REQUIRED_BAKED))("bakes a real %s", (key, pattern) => {
      expect(env[key]).toMatch(pattern);
    });
  });

  describe.each(allProfiles)("## %s profile", (profile) => {
    const env = easBuild[profile]?.env ?? {};

    it("carries no EXPO_PUBLIC_* key absent from .env.example", () => {
      // Optional keys (PostHog) may be omitted here until provisioned, but a
      // key baked into the build that the template never documents is drift.
      const stray = Object.keys(env).filter(
        (key) => key.startsWith("EXPO_PUBLIC_") && !envExampleKeys.has(key),
      );
      expect(stray).toEqual([]);
    });

    it("gives any required key it does carry a real value", () => {
      // A malformed baked value fails exactly like an absent one, and the
      // empty-string check above only catches "". Dev profiles are not
      // obliged to carry these, but a wrong value is never intended.
      for (const [key, pattern] of Object.entries(REQUIRED_BAKED)) {
        if (key in env) expect(env[key]).toMatch(pattern);
      }
    });
  });
});
