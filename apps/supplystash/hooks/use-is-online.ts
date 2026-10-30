import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const isOnline = () => onlineManager.isOnline();

/** Whether the app is online, as TanStack sees it. Components read
 * connectivity through this, never from expo-network directly, so "offline"
 * in the UI means exactly "writes are queueing and refetches are paused". On
 * native this is backed by lib/connectivity.ts; on web by the browser's
 * online/offline events. See docs/connectivity.md.
 */
export const useIsOnline = () => useSyncExternalStore(onlineManager.subscribe, isOnline);
