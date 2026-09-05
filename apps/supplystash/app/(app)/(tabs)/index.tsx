import { AppSafeScreen } from "@/components/app-safe-screen";
import { Text } from "@/components/ui/text";

// Stub screen — real designs are pending; inventory lands in project 6.
export default function InventoryScreen() {
  return (
    <AppSafeScreen className="items-center justify-center p-4">
      <Text className="text-xl font-semibold">Inventory</Text>
    </AppSafeScreen>
  );
}
