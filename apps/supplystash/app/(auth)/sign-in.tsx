import { useState } from "react";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { signInWithEmail } from "@/lib/auth";

// TEMPORARY (STASH-19 → delete in STASH-20). Hardcoded credentials for a
// throwaway account on the hosted dev project, so the auth gate and the tab
// frame can be exercised before the real form exists. `__DEV__` keeps the
// button out of release bundles; the account has no production access.
const DEV_EMAIL = "admin@supplystash.app";
const DEV_PASSWORD = "Abcd1234!";

// Stub: the real form lands in STASH-20. It exists now so the gate in
// `(app)/_layout.tsx` has somewhere to redirect to.
export default function SignInScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleDevSignIn = async () => {
    setIsPending(true);
    setError(null);

    const result = await signInWithEmail(DEV_EMAIL, DEV_PASSWORD);
    if (!result.ok) {
      setError(result.error.message);
    }

    // On success the session arrives via `onAuthStateChange` and the layout
    // guard redirects — this screen unmounts, so there is nothing to reset.
    setIsPending(false);
  };

  return (
    <AppSafeScreen className="items-center justify-center gap-4 p-4">
      <Text className="text-xl font-semibold">Sign in</Text>
      <Text className="text-muted-foreground">Coming soon.</Text>
      {__DEV__ ? (
        <>
          <Button onPress={handleDevSignIn} disabled={isPending}>
            <Text>{isPending ? "Signing in…" : "Dev sign-in"}</Text>
          </Button>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        </>
      ) : null}
    </AppSafeScreen>
  );
}
