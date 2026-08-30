import { readFileSync } from "node:fs";
import { join } from "node:path";

// Adding an EXPO_PUBLIC_* variable is a two-place edit: `.env.example` (the
// local-dev template) and the `preview` + `production` env blocks in
// `eas.json` (baked into store builds, which never see the local `.env`).
// The docs say this three times because nothing enforced it — a key added to
// one and not the other ships a build pointing at nothing, and it only
// surfaces as an opaque failure on a real device. This suite is that
// enforcement.

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

const bakedProfiles = ["preview", "production"] as const;

describe("# eas.json ⇄ .env.example mirror", () => {
  it("finds the EXPO_PUBLIC_* keys in the template", () => {
    // Guards the parser itself: if this ever reads zero keys, every assertion
    // below passes vacuously.
    expect(envExampleKeys.size).toBeGreaterThan(0);
    expect(envExampleKeys).toContain("EXPO_PUBLIC_SUPABASE_URL");
    expect(envExampleKeys).toContain("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  describe.each(bakedProfiles)("## %s profile", (profile) => {
    const env = easBuild[profile]?.env ?? {};

    it.each([...envExampleKeys])("mirrors %s from .env.example", (key) => {
      // Presence, not value: an intentionally-blank key (analytics disabled
      // until provisioned) is a conscious mirror; an absent one is the bug.
      expect(Object.keys(env)).toContain(key);
    });

    it("carries no EXPO_PUBLIC_* key missing from .env.example", () => {
      const stray = Object.keys(env).filter(
        (key) => key.startsWith("EXPO_PUBLIC_") && !envExampleKeys.has(key),
      );
      expect(stray).toEqual([]);
    });

    it("has real Supabase values, not blanks", () => {
      // Supabase is load-bearing for every screen — a blank here is a build
      // that cannot reach the backend. PostHog keys are allowed to be blank.
      expect(env.EXPO_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\/.+/);
      expect(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toMatch(/^sb_publishable_.+/);
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
