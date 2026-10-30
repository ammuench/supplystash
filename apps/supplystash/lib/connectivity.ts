import type { NetworkState } from "expo-network";

import { onlineManager } from "@tanstack/react-query";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { Platform } from "react-native";

// `isConnected` is optional, and absent means the state is not known yet.
// Treating that as offline would pause every query at launch until the first
// real reading arrives.
const isOnline = (state: NetworkState) => state.isConnected !== false;

/** Backs TanStack's online state with the device's network on native, where
 * the default `window` online/offline events do not exist. Without it nothing
 * ever pauses: offline mutations fail instead of queueing, and nothing
 * refetches on reconnect. Web keeps TanStack's defaults, which already work.
 * See docs/connectivity.md.
 */
export const wireConnectivity = () => {
  if (Platform.OS === "web") {
    return;
  }

  onlineManager.setEventListener((setOnline) => {
    // The listener only fires on a change, so the state is also read once, or
    // an app launched offline would count as online. A change that arrives
    // first is newer than that read, so the read is dropped.
    let settled = false;

    const subscription = addNetworkStateListener((state) => {
      settled = true;
      setOnline(isOnline(state));
    });

    getNetworkStateAsync()
      .then((state) => {
        if (!settled) {
          setOnline(isOnline(state));
        }
      })
      // Stays at the last known state; the listener still reports changes.
      .catch(() => {});

    return () => {
      // A read still in flight must not write over the next listener's state.
      settled = true;
      subscription.remove();
    };
  });
};
