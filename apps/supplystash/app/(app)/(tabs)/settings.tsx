import { router } from "expo-router";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toastInfo } from "@/lib/toast";

// Stub screen — real designs are pending; inventory lands in project 6.
// Temporary placement: the real account screen lands in the Auth gate +
// account deletion milestone. The sign-out flow lives in
// components/sign-out-button.tsx, so it moves with the button.
export default function SettingsScreen() {
  return (
    <AppSafeScreen className="items-center justify-center gap-4 p-4">
      <Text className="text-xl font-semibold">Settings</Text>
      <ThemePicker />
      <SignOutButton />
      {/* TODO: remove before STASH-52 merges. Temporary trigger for checking
          that bottom toasts clear the tab bar. */}
      <Button variant="outline" onPress={() => toastInfo("Test toast")}>
        <Text>Test toast</Text>
      </Button>
      {/* TODO: remove with app/(app)/theme-swatches.tsx once the designer signs
          off on the palette (STASH-32). */}
      <Button variant="outline" onPress={() => router.push("/theme-swatches")}>
        <Text>Theme swatches</Text>
      </Button>
      {/* TODO: remove with app/(app)/blocked-controls.tsx once the designer
          signs off on the blocked states (STASH-42). */}
      <Button variant="outline" onPress={() => router.push("/blocked-controls")}>
        <Text>Blocked controls</Text>
      </Button>
    </AppSafeScreen>
  );
}
