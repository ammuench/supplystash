import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { Text } from "@/components/ui/text";
import { completeOAuthCallback } from "@/lib/auth";

// Dismisses a popup-based auth session and hands the result back to the window
// that opened it. A no-op in the redirect flow we use today and on native, but
// it has to run at module scope — by the time a component effect fires, the
// opener has already stopped listening.
WebBrowser.maybeCompleteAuthSession();

// Where the OAuth redirect lands. Deliberately outside both `(auth)` and
// `(app)`, and unguarded in RootNavigator: it has to be reachable with no
// session, and either group's guard would bounce it before the exchange could
// land. Which is also why it navigates for itself — no guard will move it along.
//
// On web this is every sign-in: the page comes back from the provider with the
// PKCE `code` in its URL, and `detectSessionInUrl` is off (see lib/supabase.ts)
// so that the exchange happens here, where its errors can be reported.
//
// Native usually never mounts this — `openAuthSessionAsync` intercepts the
// redirect and lib/auth.ts drives the exchange itself. A cold start is the
// exception: the callback reaches a fresh process as a deep link with no
// `openAuthSessionAsync` promise left to receive it. That is the
// `useLinkingURL` case Supabase's React Native guide prescribes.
export default function AuthCallbackScreen() {
  // Null on web, where the browser's own URL is the callback.
  const linkingUrl = Linking.useLinkingURL();
  const url = Platform.OS === "web" ? globalThis.window?.location.href : linkingUrl;

  // A `code` is single-use, so the exchange gets exactly one attempt — a
  // re-render must not fire a second one against a value GoTrue has already
  // burned. A ref, not state: the guard has to close before the next render.
  const hasExchanged = useRef(false);

  useEffect(() => {
    if (!url || hasExchanged.current) {
      return;
    }

    hasExchanged.current = true;

    void completeOAuthCallback(url).then((result) => {
      // The SIGNED_IN the exchange fired has already reached
      // state/session.tsx, so the `(app)` guard lets this through.
      if (result.ok) {
        router.replace("/");

        return;
      }

      // `cancelled` is the user backing out, which the sign-in screen
      // deliberately leaves unannounced — bouncing silently is the whole
      // treatment.
      router.replace({
        pathname: "/sign-in",
        params: result.error.code === "cancelled" ? {} : { authError: result.error.message },
      });
    });
  }, [url]);

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <ActivityIndicator />
      <Text className="text-muted-foreground">Finishing sign-in…</Text>
    </View>
  );
}
