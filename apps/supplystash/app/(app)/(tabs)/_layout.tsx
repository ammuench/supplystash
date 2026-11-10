import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { CircleUserIcon, HouseIcon, ListChecksIcon, SettingsIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TabBarIconProps } from "@/components/tab-bar-icons";

import { AddItemTabIcon, TabBarIcon } from "@/components/tab-bar-icons";
import { TAB_BAR_HEIGHT } from "@/lib/tab-bar";

// `tabBarIcon` is called on every tab-bar render with the active tint and sizing,
// so these live at module scope: one stable identity each for the life of the
// process, rather than new closures every time this layout re-renders.
const HomeTabIcon = (props: TabBarIconProps) => <TabBarIcon icon={HouseIcon} {...props} />;

const ListsTabIcon = (props: TabBarIconProps) => <TabBarIcon icon={ListChecksIcon} {...props} />;

const SettingsTabIcon = (props: TabBarIconProps) => <TabBarIcon icon={SettingsIcon} {...props} />;

// A generic user icon for now; a real avatar waits on profiles (STASH-45).
const AccountTabIcon = (props: TabBarIconProps) => <TabBarIcon icon={CircleUserIcon} {...props} />;

// Add Item is an action, not a destination: pressing the center slot pushes
// the add-item screen over the tabs and leaves the current tab selected.
const ADD_ITEM_LISTENERS = {
  tabPress: (event: { preventDefault: () => void }) => {
    event.preventDefault();
    router.push("/add-item");
  },
};

// The bar pins each tab's content to its top edge, so the extra height above
// would all land under the label. This moves some of it above the icon.
const TAB_BAR_ICON_STYLE = { marginTop: 4 };

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // A custom height replaces the bar's own inset math, so the bottom
        // safe-area inset is added back by hand.
        tabBarStyle: { height: TAB_BAR_HEIGHT + bottom },
        tabBarIconStyle: TAB_BAR_ICON_STYLE,
      }}
    >
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
