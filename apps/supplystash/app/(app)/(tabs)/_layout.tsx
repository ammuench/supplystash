import { Tabs } from "expo-router/js-tabs";
import { ListChecksIcon, PackageIcon, SettingsIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => <Icon as={PackageIcon} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: "Shopping List",
          tabBarIcon: ({ color, size }) => <Icon as={ListChecksIcon} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Icon as={SettingsIcon} color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
