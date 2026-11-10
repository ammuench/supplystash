import { Redirect } from "expo-router";

// This route exists only to give the tab bar its center slot. The tab press is
// intercepted in the tabs layout and pushes /add-item instead, so this screen
// is never shown from the bar. A direct visit (a typed URL on web) lands on
// the same place.
export default function AddTabRoute() {
  return <Redirect href="/add-item" />;
}
