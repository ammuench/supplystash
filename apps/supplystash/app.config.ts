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
    output: "static",
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
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "67e10638-3ac6-4a35-8dbb-0a90f9a0b38d",
    },
  },
};

export default config;
