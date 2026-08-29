import type { ExpoConfig } from "expo/config";

import pkg from "./package.json";

const isProduction = process.env.EAS_BUILD_PROFILE === "production";
const isPreview = process.env.EAS_BUILD_PROFILE === "preview";

// iOS and Android intentionally share one identifier per profile, so all three
// variants can sit side by side on a device without colliding.
const appIdentifier = isProduction
  ? "app.supplystash"
  : isPreview
    ? "app.supplystash.preview"
    : "app.supplystash.dev";

// Whether to inject PostHog's source-map upload build phase. Two conditions,
// both required, because either one missing breaks the build rather than
// degrading:
//
//   1. preview/production only — the injected "Bundle React Native code and
//      images" phase shells out to the posthog-cli binary, which only the
//      eas-build-post-install hook installs, and only for those two profiles.
//   2. POSTHOG_CLI_ENV_ID present — without it the upload cannot authenticate.
//      Until PostHog is fully provisioned this is unset, so the plugin stays
//      out of the build entirely instead of failing it.
//
// With this off, stack traces from those builds arrive unsymbolicated. Every
// other PostHog feature is unaffected.
const uploadSourceMaps = (isProduction || isPreview) && Boolean(process.env.POSTHOG_CLI_ENV_ID);

const config: ExpoConfig = {
  name: isProduction ? "Supply Stash" : isPreview ? "Supply Stash Preview" : "Supply Stash Dev",
  slug: "supply-stash",
  version: pkg.version,
  scheme: "supply-stash",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  // TODO: per-variant icons. ship three tinted sets so you can tell
  // dev/preview/prod apart on the home screen; supplystash only has one so far.
  icon: "./assets/images/icon.png",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: appIdentifier,
    userInterfaceStyle: "automatic",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: appIdentifier,
    userInterfaceStyle: "automatic",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
  },
  web: {
    bundler: "metro",
    // Every route in this app sits behind auth, so there is nothing for a
    // crawler to index and nothing worth prerendering. "static" would render
    // each route through Node at build time, which buys no SEO here and costs
    // a whole class of bug — components having to survive an environment with
    // no window or localStorage, plus hydration mismatches. A marketing site,
    // if we build one, is a separate deploy.
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    "expo-status-bar",
    "expo-localization",
    "expo-secure-store",
    "expo-web-browser",
    // skipOnConflict: rebuilding the same version reuses a deterministic Hermes
    // chunk ID, so PostHog already holds that symbol set — skip the re-upload
    // rather than failing the build on content_hash_mismatch.
    ...(uploadSourceMaps
      ? [
          ["posthog-react-native/expo", { skipOnConflict: true }] as [
            string,
            Record<string, unknown>,
          ],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "67e10638-3ac6-4a35-8dbb-0a90f9a0b38d",
    },
    // Read and validated once by lib/env.ts. EAS bakes `extra` into the binary,
    // so these must come from the build environment, not from process.env at
    // runtime.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  },
};

export default config;
