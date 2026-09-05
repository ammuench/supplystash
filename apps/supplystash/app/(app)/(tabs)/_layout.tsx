import type { ColorValue } from "react-native";

import { Tabs } from "expo-router/js-tabs";
import { ListChecksIcon, PackageIcon, SettingsIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";

// `tabBarIcon` is called on every tab-bar render with the active tint and sizing,
// so these live at module scope: one stable identity each for the life of the
// process, rather than three new closures every time this layout re-renders.
type TabBarIconProps = {
  color: ColorValue;
  size: number;
};

const InventoryTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={PackageIcon} color={color} size={size} />
);

const ShoppingListTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={ListChecksIcon} color={color} size={size} />
);

const SettingsTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={SettingsIcon} color={color} size={size} />
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Inventory",
          tabBarIcon: InventoryTabIcon,
        }}
      />
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: "Shopping List",
          tabBarIcon: ShoppingListTabIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: SettingsTabIcon,
        }}
      />
    </Tabs>
  );
}
