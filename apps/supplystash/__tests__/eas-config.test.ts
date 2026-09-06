/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `eas.json` bakes each profile's env block into the binary at build time. EAS
// never sees the local `.env`, because git ignores it. This suite guards three
// failure modes:
//
//   1. A store profile without a required Supabase var. The build ships
//      pointing at nothing and fails opaquely on a device.
//   2. An env value set to "". `eas build` rejects the whole file with "not
//      allowed to be empty" before it starts. Omit the key instead: lib/env.ts
//      and app.config.ts both read an absent key as "not configured".
//   3. A baked key that `.env.example` does not document. The two files drift.
//
// Of the dev profiles, only `development` bakes the Supabase keys. It is an
// internal build that can run on a device with no dev server, where the app
// reads the build-time manifest and an empty `extra` throws in lib/env.ts.
// `development-simulator` builds locally and always has Metro, so it needs no
// baked values. The tests below therefore do not require these keys in a dev
// profile, but they do require a correct value when one is present.

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

// Every store profile must set these to a real value. The app cannot reach the
// backend without them.
const REQUIRED_BAKED = {
  EXPO_PUBLIC_SUPABASE_URL: /^https:\/\/.+/,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: /^sb_publishable_.+/,
} as const;

const storeProfiles = ["preview", "production"] as const;
const devProfiles = ["development", "development-simulator"] as const;
const allProfiles = [...storeProfiles, ...devProfiles] as const;

describe("# eas.json config", () => {
  it("finds the EXPO_PUBLIC_* keys in the template", () => {
    // Guards the parser. Zero keys would make the stray-key check vacuous.
    expect(envExampleKeys.size).toBeGreaterThan(0);
    expect(envExampleKeys).toContain("EXPO_PUBLIC_SUPABASE_URL");
  });

  it("has no empty-string env value in any profile", () => {
    // `eas build` rejects this exact shape before it starts.
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
      // You can omit an optional key (PostHog) until you provision it. A baked
      // key that the template does not document is drift.
      const stray = Object.keys(env).filter(
        (key) => key.startsWith("EXPO_PUBLIC_") && !envExampleKeys.has(key),
      );
      expect(stray).toEqual([]);
    });

    it("gives any required key it does carry a real value", () => {
      // A malformed value fails like an absent one, and the empty-string test
      // above catches only "". A dev profile need not carry these keys, but a
      // wrong value is always an error.
      for (const [key, pattern] of Object.entries(REQUIRED_BAKED)) {
        if (key in env) expect(env[key]).toMatch(pattern);
      }
    });
  });
});
