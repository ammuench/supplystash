import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import type { Database } from "@/lib/database.types";

import { oauthErrorFromUrl } from "@/lib/auth-callback-url";
import { env } from "@/lib/env";

// As Expo's SecureStore does not support values larger than 2048 bytes, an
// AES-256 key is generated and stored in SecureStore, while it is used to
// encrypt/decrypt values stored in AsyncStorage. A Supabase session carries a
// JWT and routinely exceeds that limit, so it cannot live in SecureStore
// directly.
//
// Taken from Supabase's own Expo guide, near-verbatim and deliberately so —
// the docs warn that optimizing this example can introduce subtle security
// vulnerabilities:
// https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store
export class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return encryptionKeyHex;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return encrypted;
    }

    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);

    await AsyncStorage.setItem(key, encrypted);
  }
}

const isWeb = Platform.OS === "web";

export const authConfig = {
  // SecureStore has no web implementation, so LargeSecureStore is native-only.
  // Passing no storage on web is deliberate: supabase-js falls back to
  // localStorage in a browser and to an in-memory adapter when there is none,
  // which is what keeps the `output: "static"` prerender (Node, no
  // localStorage) from throwing. Reimplementing that here would only duplicate
  // it worse.
  //
  // Note the asymmetry this leaves: a native session is AES-encrypted at rest,
  // while a web session sits in localStorage as plaintext, readable by any
  // script on the origin. That is the standard web tradeoff, not an oversight.
  storage: isWeb ? undefined : new LargeSecureStore(),
  autoRefreshToken: true,
  persistSession: true,
  // Web signs in through a redirect, so Supabase has to read the PKCE `code`
  // back out of the URL itself. React Native has no URL bar to read it from —
  // deep links are handled explicitly by the auth flow instead.
  detectSessionInUrl: isWeb,
  // PKCE, and pinned rather than left to the supabase-js default. Under the
  // implicit flow the access *and* refresh tokens ride back inside the
  // `supply-stash://` callback URL with nothing binding them to the request, so
  // any other installed app that claims the same custom scheme could intercept
  // the redirect and walk away with a replayable refresh token. PKCE sends back
  // a single-use `?code=` instead, which is worthless without the verifier held
  // in LargeSecureStore (localStorage on web).
  //
  // Pinned because the callback parser in lib/auth.ts reads `code` and calls
  // `exchangeCodeForSession`: a default flip back to implicit would hand it
  // fragment tokens and turn every native sign-in into "No session was
  // returned."
  flowType: "pkce" as const,
};

// Read before `createClient`, and deliberately so: `detectSessionInUrl` runs
// during client initialization and strips the OAuth parameters off the URL, so
// anything reading `window.location` from inside a component is racing it and
// usually loses. A declined consent screen is the case that matters — no
// session is ever coming, so app/auth-callback.tsx needs this to know to bounce
// instead of spinning forever.
//
// Non-null only on the one page load that the provider redirected into; null on
// native, where the error comes back through `openAuthSessionAsync`. The
// `location` guard covers the `output: "static"` prerender, which runs this
// module in Node with no URL of any kind.
const launchUrl = isWeb ? globalThis.window?.location : undefined;

export const oauthErrorFromLaunchUrl = launchUrl
  ? oauthErrorFromUrl(`${launchUrl.search}${launchUrl.hash}`)
  : null;

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: authConfig,
});
