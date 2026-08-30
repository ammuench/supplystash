import Constants from "expo-constants";
import { z } from "zod";

// Public config travels through app.config.ts `extra` rather than being read
// from process.env at runtime — EAS builds bake `extra` into the binary, while
// process.env is only populated at bundle time. Parsing it once here means a
// missing key fails loudly at startup instead of as an opaque network error.

// An unset var reaches us as undefined, but eas.json can only express "not
// configured yet" as "", and dotenv turns a bare `KEY=` into "" too. Both mean
// absent, so collapse them before validating — otherwise an empty string is
// "present but invalid" and throws on launch, breaking the build for everyone.
const absentAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const envSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(1),
  // Optional: with no key, lib/analytics.ts builds no client and every capture
  // becomes a no-op, so local development needs no PostHog project.
  posthogApiKey: absentAsUndefined(z.string().min(1).optional()),
  // EU region by default. PostHog's EU cloud keeps event data in the EU, which
  // is what our GDPR posture depends on — a build that silently fell back to
  // the US host would ship personal data to the wrong jurisdiction.
  posthogHost: absentAsUndefined(z.url().default("https://eu.i.posthog.com")),
});

const parsed = envSchema.safeParse(Constants.expoConfig?.extra ?? {});

if (!parsed.success) {
  throw new Error(`Invalid app config in app.config.ts "extra": ${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
