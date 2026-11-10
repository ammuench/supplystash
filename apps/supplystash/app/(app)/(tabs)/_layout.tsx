import type { ColorValue } from "react-native";

import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import {
  CircleUserIcon,
  HouseIcon,
  ListChecksIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react-native";

import { Icon } from "@/components/ui/icon";

// `tabBarIcon` is called on every tab-bar render with the active tint and sizing,
// so these live at module scope: one stable identity each for the life of the
// process, rather than new closures every time this layout re-renders.
type TabBarIconProps = {
  color: ColorValue;
  size: number;
};

const HomeTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={HouseIcon} color={color} size={size} />
);

const ListsTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={ListChecksIcon} color={color} size={size} />
);

const AddItemTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={PlusIcon} color={color} size={size} />
);

const SettingsTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={SettingsIcon} color={color} size={size} />
);

const AccountTabIcon = ({ color, size }: TabBarIconProps) => (
  <Icon as={CircleUserIcon} color={color} size={size} />
);

// Add Item is an action, not a destination: pressing the center slot pushes
// the add-item screen over the tabs and leaves the current tab selected.
const ADD_ITEM_LISTENERS = {
  tabPress: (event: { preventDefault: () => void }) => {
    event.preventDefault();
    router.push("/add-item");
  },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: HomeTabIcon }} />
      <Tabs.Screen name="lists" options={{ title: "Lists", tabBarIcon: ListsTabIcon }} />
      <Tabs.Screen
        name="add"
        options={{ title: "Add Item", tabBarIcon: AddItemTabIcon }}
        listeners={ADD_ITEM_LISTENERS}
      />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: SettingsTabIcon }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: AccountTabIcon }} />
    </Tabs>
  );
}
