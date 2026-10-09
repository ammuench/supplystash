import { router } from "expo-router";
import { useState } from "react";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { signOut } from "@/lib/auth";
import { toastError, toastSuccess } from "@/lib/toast";

// Stub screen — real designs are pending; inventory lands in project 6.
// Temporary placement: the real account screen lands in the Auth gate +
// account deletion milestone. Nothing to do on success: `onAuthStateChange`
// clears the query cache (STASH-21) and the `(app)` guard redirects to
// sign-in, unmounting this screen.
export default function SettingsScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      const result = await signOut();
      if (result.ok) {
        toastSuccess("Signed out");
      } else {
        toastError(result.error.message);
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AppSafeScreen className="items-center justify-center gap-4 p-4">
      <Text className="text-xl font-semibold">Settings</Text>
      <ThemePicker />
      <Button disabled={isSigningOut} onPress={() => void handleSignOut()}>
        <Text>{isSigningOut ? "Signing out…" : "Log Out"}</Text>
      </Button>
      {/* TODO: remove with app/(app)/theme-swatches.tsx once the designer signs
          off on the palette (STASH-32). */}
      <Button variant="outline" onPress={() => router.push("/theme-swatches")}>
        <Text>Theme swatches</Text>
      </Button>
    </AppSafeScreen>
  );
}
