import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/ui/text";
import { oauthUrlFailure } from "@/lib/auth-callback-url";
import { oauthErrorFromLaunchUrl } from "@/lib/supabase";
import { useSession } from "@/state/session";

// Dismisses a popup-based auth session and hands the result back to the window
// that opened it. A no-op in the redirect flow we use today and on native, but
// it has to run at module scope — by the time a component effect fires, the
// opener has already stopped listening.
WebBrowser.maybeCompleteAuthSession();

// Where the web OAuth redirect lands. Deliberately outside both `(auth)` and
// `(app)`: it has to be reachable with no session, and the gate in either group
// would bounce it before the session arrives.
//
// Which is also why this screen has to navigate for itself. Nothing else will:
// `detectSessionInUrl` (see lib/supabase.ts) reads the PKCE code out of the URL
// and state/session.tsx picks up the SIGNED_IN, but all that does is update the
// provider — there is no layout gate over this route to redirect it.
//
// It does not touch `setSession`: GoTrue has already consumed the code by the
// time this mounts, and a second exchange would race it for a single-use value.
//
// On native this never mounts — `openAuthSessionAsync` intercepts the redirect
// and lib/auth.ts drives the exchange itself. If a cold start ever routes here,
// the session effect below resolves it the same way.
export default function AuthCallbackScreen() {
  const { session, isLoading } = useSession();
  const { error, error_description: errorDescription } = useLocalSearchParams<{
    error?: string;
    error_description?: string;
  }>();

  // A declined consent screen returns an error instead of a code, so no
  // SIGNED_IN is ever coming and the spinner would hang forever. Providers put
  // it in either half of the URL, and `detectSessionInUrl` strips the fragment
  // during client init, so the search params alone are not enough — the
  // snapshot taken before that is the reliable source. The provider's own
  // wording is carried across so the user does not land on a bare form with no
  // explanation; `error` alone is a code like `access_denied`, so it is only the
  // fallback.
  const failure = error
    ? oauthUrlFailure(error, errorDescription ?? null)
    : oauthErrorFromLaunchUrl;
  // The message, not the object: `oauthUrlFailure` builds a fresh one every
  // render, which as an effect dependency would re-fire the redirect on each.
  const failureMessage = failure?.message ?? null;

  useEffect(() => {
    if (failureMessage) {
      router.replace({ pathname: "/sign-in", params: { authError: failureMessage } });

      return;
    }

    // The happy path: hand off to `(app)`, whose own gate takes it from here.
    if (!isLoading && session) {
      router.replace("/");
    }
  }, [failureMessage, isLoading, session]);

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <ActivityIndicator />
      <Text className="text-muted-foreground">Finishing sign-in…</Text>
    </View>
  );
}
