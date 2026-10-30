# Connectivity

TanStack Query decides when to pause writes and when to refetch from two global singletons:
`onlineManager` (is there a network?) and `focusManager` (is the app in front?). Their defaults
listen to browser events, which React Native does not have. Without wiring, a native app is
always "online" and never "refocused": offline writes fail instead of queueing, and nothing
refetches on reconnect or on return to the foreground.

Origin: `supply-stash-architecture.md` §5.3, §5.6, §5.8. Built in STASH-39.

## Signal sources

|            | Native                                                       | Web                                       |
| ---------- | ------------------------------------------------------------ | ----------------------------------------- |
| **Online** | `expo-network`: `addNetworkStateListener` + one initial read | TanStack default: `window` online/offline |
| **Focus**  | `AppState`: `"active"` is focused, anything else is not      | TanStack default: `visibilitychange`      |

Wired by `wireConnectivity()` in
[`apps/supplystash/lib/connectivity.ts`](../apps/supplystash/lib/connectivity.ts), called at
module scope in `app/_layout.tsx`. It must run before the first render, so the online state is
real by the time `QueryProvider` restores the paused-mutation queue and resumes it.

## Rules

1. **Components read connectivity through `useIsOnline()`**
   ([`hooks/use-is-online.ts`](../apps/supplystash/hooks/use-is-online.ts)). Never import
   `expo-network` in a component. The hook reads `onlineManager`, so "offline" in the UI means
   exactly "writes are queueing and refetches are paused".
2. **Offline means `isConnected === false`.** A missing value means "not known yet" and counts as
   online. Treating it as offline would pause every query at launch.
3. **The initial read loses to a newer change.** `addNetworkStateListener` fires only on a
   change, so the state is also read once at setup (otherwise an app launched offline counts as
   online). A listener event that arrives before that read resolves wins.
4. **iOS overlays count as unfocused.** Control Center, the app switcher, or a call moves
   `AppState` to `"inactive"`. Dismissing it is a refocus, so stale queries refetch. That is the
   self-heal for a dropped Realtime socket (§5.3).

## What "offline" does not detect

A **captive portal** or a dead backend: the device has a network, so the app is "online", but
requests fail. That is the query-level "refetch is failing" signal from §5.6, not this layer.
`isInternetReachable` would not help: on iOS, `expo-network` reports it equal to `isConnected`.

## Why `expo-network`, not NetInfo

Both are in Expo SDK 56's supported-module list. NetInfo's one advantage is a real reachability
ping on iOS, which rule 2 does not use. With that gone, the tiebreaker is the same one that
picked `expo-sqlite` ([persistence.md](./persistence.md)): `expo-network` is in Expo's own module
set and upgrades with the SDK. Native module, so it needs a **dev build**.

## Tests

- [`lib/__tests__/connectivity.test.ts`](../apps/supplystash/lib/__tests__/connectivity.test.ts):
  the wiring, plus the TanStack behaviour it enables (pause and resume, refetch on reconnect and
  on foreground).
- [`hooks/__tests__/use-is-online.test.ts`](../apps/supplystash/hooks/__tests__/use-is-online.test.ts):
  the hook, including unsubscribe on unmount.
- `expo-network` ships no jest mock. The global one in `utils/testing/setupTests.ts` reports a
  connected device; take the listener from `addNetworkStateListener.mock.calls` to fire changes.
