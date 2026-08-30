// lib/env.ts validates at import time, so each case needs a fresh module
// registry with different `extra` values.
const loadEnv = (extra: Record<string, unknown>) => {
  let loaded: typeof import("@/lib/env").env | undefined;

  jest.isolateModules(() => {
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: { expoConfig: { extra } },
    }));
    loaded = (require("@/lib/env") as typeof import("@/lib/env")).env;
  });

  return loaded!;
};

const REQUIRED = {
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "sb_publishable_test",
};

describe("# env", () => {
  it("treats an empty string as absent, not as an invalid value", () => {
    // eas.json cannot express "not configured yet" except as "", and dotenv
    // turns a bare `KEY=` into "" too. Rejecting those would throw on launch
    // and break every preview and production build.
    const env = loadEnv({ ...REQUIRED, posthogApiKey: "", posthogHost: "" });

    expect(env.posthogApiKey).toBeUndefined();
    expect(env.posthogHost).toBe("https://eu.i.posthog.com");
  });

  it("defaults PostHog to the EU region", () => {
    // GDPR: event data must stay in the EU, so a US fallback is a defect.
    expect(loadEnv(REQUIRED).posthogHost).toBe("https://eu.i.posthog.com");
  });

  it("keeps a configured host", () => {
    const env = loadEnv({ ...REQUIRED, posthogHost: "https://posthog.internal" });

    expect(env.posthogHost).toBe("https://posthog.internal");
  });

  it("throws when Supabase config is missing, rather than failing later", () => {
    expect(() => loadEnv({})).toThrow(/Invalid app config/);
  });

  it("throws when the Supabase URL is not a URL", () => {
    expect(() => loadEnv({ ...REQUIRED, supabaseUrl: "127.0.0.1:54321" })).toThrow(
      /Invalid app config/,
    );
  });
});
