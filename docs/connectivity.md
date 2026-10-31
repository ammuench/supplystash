# Connectivity

TanStack Query decides when to pause writes and when to refetch from two global singletons:
`onlineManager` (is there a network?) and `focusManager` (is the app in front?). Their defaults
listen to browser events, which React Native does not have. Without wiring, a native app is
always "online" and never "refocused": offline writes fail instead of queueing, and nothing
refetches on reconnect or on return to the foreground.

Origin: `supply-stash-architecture.md` §5.3, §5.6, §5.8. Built in STASH-39 (wiring) and STASH-40
(banner).

## Signal sources

|            | Native                                                       | Web                                       |
| ---------- | ------------------------------------------------------------ | ----------------------------------------- |
| **Online** | `expo-network`: `addNetworkStateListener` + one initial read | TanStack default: `window` online/offline |
| **Focus**  | `AppState`: `"active"` is focused, anything else is not      | TanStack default: `visibilitychange`      |

Wired by `wireConnectivity()` in
[`apps/supplystash/lib/connectivity.ts`](../apps/supplystash/lib/connectivity.ts), called at
module scope in `app/_layout.tsx`, so the first network reading is already on its way before the
first render.

Until that reading lands, `onlineManager` reports TanStack's default of online, which is a guess.
`whenOnlineStateKnown()` settles once the real state is in (first event, initial read, or a failed
read). The native `QueryProvider` waits on it before replaying the restored paused-mutation queue.
Otherwise an offline launch would fire the queue into a dead connection, and each write would
leave disk while it retried.

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

## Offline banner

[`components/offline-banner.tsx`](../apps/supplystash/components/offline-banner.tsx), mounted
once in `app/(app)/_layout.tsx`. It reads `useIsOnline()`, so it is up exactly while writes queue.

| State   | Native                                                                                                 | Web                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Online  | Nothing                                                                                                | Nothing                                                                      |
| Offline | _"Offline — changes will sync when the connection is reestablished."_ + age if the data is over 3 days | _"Offline — you can't change values until the connection is reestablished."_ |

- **Age** is _"Last updated 5 days ago."_, from `useOldestPersistedUpdatedAt()`
  ([`hooks/use-oldest-persisted-updated-at.ts`](../apps/supplystash/hooks/use-oldest-persisted-updated-at.ts)):
  the oldest `dataUpdatedAt` across the persisted roots (`isPersistedQuery`). Memory-only roots
  are always as fresh as the session, so they say nothing about age.
- **No age on web.** Web persists nothing ([persistence.md](./persistence.md)), so its data is
  never older than the tab.
- **Pushes content, never covers it.** It sits above the `Stack` in a flex column, so screens
  shrink from the top. It pads the top inset itself; a screen's native `SafeAreaView` pads only
  where it overlaps the unsafe area, so it adds nothing below the banner. An overlay would hide
  the top of every screen for as long as the device is offline.
- **A `bg-card` strip with an amber icon, not §5.6's "dark top banner".** A dark strip in the
  light theme sits under dark status-bar text. A theme surface keeps the existing status-bar
  style readable in both themes. Amber matches §5.6: it already means "your changes are
  queueing".
- **Known limit.** The age is worked out when the banner appears and is not refreshed while
  offline. If the app stays suspended offline across the 3-day mark, the age shows once the app
  restarts or the connection drops again. Accepted: multi-day offline sessions are rare, and the
  main message is still correct.

## Tests

- [`lib/__tests__/connectivity.test.ts`](../apps/supplystash/lib/__tests__/connectivity.test.ts):
  the wiring, plus the TanStack behaviour it enables (pause and resume, refetch on reconnect and
  on foreground).
- [`hooks/__tests__/use-is-online.test.ts`](../apps/supplystash/hooks/__tests__/use-is-online.test.ts):
  the hook, including unsubscribe on unmount.
- `expo-network` ships no jest mock. The global one in `utils/testing/setupTests.ts` reports a
  connected device; take the listener from `addNetworkStateListener.mock.calls` to fire changes.
- [`hooks/__tests__/use-oldest-persisted-updated-at.test.tsx`](../apps/supplystash/hooks/__tests__/use-oldest-persisted-updated-at.test.tsx)
  and [`components/__tests__/offline-banner.test.tsx`](../apps/supplystash/components/__tests__/offline-banner.test.tsx):
  the age and the banner's copy per platform.
