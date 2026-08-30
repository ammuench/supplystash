import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import type { Database } from "@/lib/database.types";

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
  // Web signs in through a redirect, so Supabase has to read the OAuth fragment
  // out of the URL. React Native has no URL bar to read it from — deep links
  // are handled explicitly by the auth flow instead.
  detectSessionInUrl: isWeb,
};

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: authConfig,
});
