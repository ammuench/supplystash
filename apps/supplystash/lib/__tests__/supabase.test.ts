import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { LargeSecureStore } from "@/lib/supabase";

// A realistic Supabase session: the whole reason SecureStore cannot hold this
// directly is that it exceeds the 2048-byte limit.
const SESSION = JSON.stringify({
  access_token: `header.${"p".repeat(2200)}.signature`,
  refresh_token: "v1.MRjRSFdEXAMPLE",
  expires_at: 1_800_000_000,
  user: { id: "00000000-0000-0000-0000-000000000000" },
});

const KEY = "sb-127-auth-token";

describe("# LargeSecureStore", () => {
  let storage: LargeSecureStore;

  beforeEach(async () => {
    storage = new LargeSecureStore();
    await AsyncStorage.clear();
    await SecureStore.deleteItemAsync(KEY);
  });

  it("round-trips a session larger than SecureStore's 2048-byte limit", async () => {
    expect(SESSION.length).toBeGreaterThan(2048);

    await storage.setItem(KEY, SESSION);

    expect(await storage.getItem(KEY)).toBe(SESSION);
  });

  it("returns null for a key that was never written", async () => {
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it("keeps the session out of AsyncStorage in plaintext", async () => {
    await storage.setItem(KEY, SESSION);

    const stored = await AsyncStorage.getItem(KEY);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("refresh_token");
    expect(stored).not.toContain("v1.MRjRSFdEXAMPLE");
  });

  it("stores only the AES key in SecureStore, within the size limit", async () => {
    await storage.setItem(KEY, SESSION);

    const secured = await SecureStore.getItemAsync(KEY);
    // 256-bit key, hex encoded.
    expect(secured).toHaveLength(64);
    expect(secured!.length).toBeLessThan(2048);
  });

  it("removes both halves, so a stale key cannot decrypt a stale value", async () => {
    await storage.setItem(KEY, SESSION);
    await storage.removeItem(KEY);

    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(await SecureStore.getItemAsync(KEY)).toBeNull();
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it("uses a fresh encryption key on every write", async () => {
    await storage.setItem(KEY, SESSION);
    const firstKey = await SecureStore.getItemAsync(KEY);

    await storage.setItem(KEY, SESSION);
    const secondKey = await SecureStore.getItemAsync(KEY);

    expect(secondKey).not.toBe(firstKey);
    // The value written last must still decrypt with the key written last.
    expect(await storage.getItem(KEY)).toBe(SESSION);
  });
});
