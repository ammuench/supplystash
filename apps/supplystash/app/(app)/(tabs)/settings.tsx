import { AppSafeScreen } from "@/components/app-safe-screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { signOut } from "@/lib/auth";

// Stub screen — real designs are pending; inventory lands in project 6.
export default function SettingsScreen() {
  return (
    <AppSafeScreen className="items-center justify-center p-4">
      <Text className="text-xl font-semibold">Settings</Text>
      <Button
        onPress={() => {
          signOut();
        }}
      >
        <Text>Log Out</Text>
      </Button>
    </AppSafeScreen>
  );
}
