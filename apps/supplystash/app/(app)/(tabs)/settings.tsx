import { router } from "expo-router";
import { useState } from "react";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { signOut } from "@/lib/auth";
import { isThemePreference, useThemePreference } from "@/lib/theme-preference";
import { toastError, toastSuccess } from "@/lib/toast";

// Stub screen — real designs are pending; inventory lands in project 6.
// Temporary placement: the real account screen lands in the Auth gate +
// account deletion milestone. Nothing to do on success: `onAuthStateChange`
// clears the query cache (STASH-21) and the `(app)` guard redirects to
// sign-in, unmounting this screen.
export default function SettingsScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { preference, setPreference } = useThemePreference();

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
      {/* Tabs without TabsContent renders as a segmented control. */}
      <Text className="text-sm text-muted-foreground">Appearance</Text>
      <Tabs
        value={preference}
        onValueChange={(value) => {
          if (isThemePreference(value)) {
            void setPreference(value);
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="system">
            <Text>System</Text>
          </TabsTrigger>
          <TabsTrigger value="light">
            <Text>Light</Text>
          </TabsTrigger>
          <TabsTrigger value="dark">
            <Text>Dark</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>
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
