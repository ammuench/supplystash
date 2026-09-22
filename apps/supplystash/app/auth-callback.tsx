import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/ui/text";

// Where the web OAuth redirect lands. Deliberately outside both `(auth)` and
// `(app)`: it has to be reachable with no session, and the gate in either group
// would bounce it before the session arrives.
//
// This screen is a waiting room, not a handler. `detectSessionInUrl` (see
// lib/supabase.ts) has already read the tokens out of the fragment and stripped
// the hash by the time this mounts, and state/session.tsx will receive the
// SIGNED_IN that redirects away. Calling `setSession` here would race GoTrue for
// tokens it has already consumed.
//
// On native this never mounts — `openAuthSessionAsync` intercepts the redirect
// and lib/auth.ts sets the session itself. If a cold start ever routes here, the
// spinner resolves the same way once the session provider settles.
export default function AuthCallbackScreen() {
  const { error } = useLocalSearchParams<{ error?: string }>();

  // A declined consent screen returns an error instead of tokens, so no
  // SIGNED_IN is ever coming and the spinner would hang forever.
  useEffect(() => {
    if (error) {
      router.replace("/sign-in");
    }
  }, [error]);

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <ActivityIndicator />
      <Text className="text-muted-foreground">Finishing sign-in…</Text>
    </View>
  );
}
