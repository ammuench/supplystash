import PostHog from "posthog-react-native";

import { env } from "@/lib/env";

// Null when no key is configured (local dev), so every call site can stay
// unconditional and analytics simply does nothing.
export const posthog = env.posthogApiKey
  ? new PostHog(env.posthogApiKey, {
      host: env.posthogHost,
      // Screen views come from expo-router's own navigation container, which
      // PostHogProvider hooks into; autocapturing taps as well produces noise
      // without names worth querying.
      enableSessionReplay: false,
    })
  : null;

// Derived from PostHog's own signature rather than restated as
// Record<string, unknown>, which is wider than the JSON values it accepts.
type EventProperties = Parameters<PostHog["capture"]>[1];

export const capture = (event: string, properties?: EventProperties) => {
  posthog?.capture(event, properties);
};

/** Call after sign-in so events attach to the Supabase user id. */
export const identify = (userId: string, properties?: EventProperties) => {
  posthog?.identify(userId, properties);
};

/** Call on sign-out so the next session is not attributed to the old user. */
export const resetAnalytics = () => {
  posthog?.reset();
};
