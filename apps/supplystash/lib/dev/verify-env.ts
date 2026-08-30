import Constants from "expo-constants";
import { Platform } from "react-native";

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

// STASH-8 — verify the Supabase env vars reach a real device and actually work.
//
// TEMPORARY. This is a throwaway diagnostic. Delete it (and its call in
// app/_layout.tsx) once STASH-8 is closed, or fold the reachability check into
// the Auth & Session splash/gate work. It is __DEV__-gated and never ships in a
// preview or production build.
//
// It answers three questions the local test suite cannot:
//   1. Did app.config.ts `extra` get baked into / served to this device at all?
//   2. Does the configured URL resolve to a real Supabase instance?
//   3. Is the publishable key accepted by that instance?

const TAG = "[STASH-8 env check]";

const maskKey = (key: string) =>
  key.length <= 12 ? "<too-short>" : `${key.slice(0, 8)}…${key.slice(-4)} (len ${key.length})`;

export async function verifyEnvOnDevice() {
  console.log(`${TAG} platform=${Platform.OS} ownership=${Constants.appOwnership ?? "standalone"}`);
  console.log(`${TAG} supabaseUrl = ${env.supabaseUrl}`);
  console.log(`${TAG} publishableKey = ${maskKey(env.supabasePublishableKey)}`);
  console.log(
    `${TAG} posthog = ${env.posthogApiKey ? "configured" : "disabled"} @ ${env.posthogHost}`,
  );

  // Q2 — URL resolves. A wrong/unreachable host rejects here with a network
  // error ("Network request failed" / DNS). A reachable host returns cleanly
  // with session: null (nobody is signed in yet — expected).
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn(`${TAG} getSession error: ${error.message}`);
    } else {
      console.log(
        `${TAG} getSession OK — session is ${data.session ? "PRESENT" : "null (expected)"}`,
      );
    }
  } catch (err) {
    console.error(`${TAG} getSession THREW — URL likely wrong or unreachable:`, err);
  }

  // Q3 — publishable key accepted. Unauthenticated select on an RLS-protected
  // table: a valid key returns [] with HTTP 200 (RLS filters every row). An
  // invalid/absent key returns an error mentioning "API key".
  try {
    const { data, error } = await supabase.from("homes").select("id").limit(1);
    if (error) {
      const badKey = /api key/i.test(error.message);
      console.error(
        `${TAG} homes probe error${badKey ? " — PUBLISHABLE KEY REJECTED" : ""}: ${error.message}`,
      );
    } else {
      console.log(`${TAG} homes probe OK — key accepted, ${data.length} row(s) visible pre-auth`);
    }
  } catch (err) {
    console.error(`${TAG} homes probe THREW:`, err);
  }

  console.log(`${TAG} done`);
}
