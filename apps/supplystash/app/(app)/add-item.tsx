import { Stack } from "expo-router";

import { PlaceholderScreen } from "@/components/placeholder-screen";

// Placeholder: add item lands in project 6. Pushed over the tabs, not a tab of
// its own, so it shows a header to give the user a way back.
export default function AddItemScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Add Item" }} />
      <PlaceholderScreen title="Add Item" edges={["bottom", "left", "right"]} />
    </>
  );
}
