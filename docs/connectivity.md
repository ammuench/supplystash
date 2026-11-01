# Connectivity

TanStack Query decides when to pause writes and when to refetch from two global singletons:
`onlineManager` (is there a network?) and `focusManager` (is the app in front?). Their defaults
listen to browser events, which React Native does not have. Without wiring, a native app is
always "online" and never "refocused": offline writes fail instead of queueing, and nothing
refetches on reconnect or on return to the foreground.

Origin: `supply-stash-architecture.md` §5.3, §5.6, §5.8. Built in STASH-39 (wiring), STASH-40
(offline banner), STASH-41 (unreachable bar), and STASH-42 (blocked controls).

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
requests fail. That is the query-level signal behind the [unreachable bar](#unreachable-bar), not
this layer. `isInternetReachable` would not help: on iOS, `expo-network` reports it equal to
`isConnected`.

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

## Unreachable bar

[`components/server-unreachable-bar.tsx`](../apps/supplystash/components/server-unreachable-bar.tsx),
mounted right after the offline banner. It is up while the app is online but a persisted query
cannot reach the server. It is what makes `maxAge: Infinity` safe (§5.6): saved data never shows
as current, because either the offline banner or this bar is up.

| State                              | Native and web                                                     |
| ---------------------------------- | ------------------------------------------------------------------ |
| Offline                            | Nothing (the offline banner wins)                                  |
| Online, a persisted query failing  | _"Can't reach the server — showing your last saved list."_ + Retry |
| Same, but no persisted data at all | _"Can't reach the server."_ + Retry                                |

- **The signal** is `useIsServerUnreachable()`
  ([`hooks/use-is-server-unreachable.ts`](../apps/supplystash/hooks/use-is-server-unreachable.ts)):
  any persisted-root query in `status: "error"` with a network failure. No failure counter: with
  the default `retry: 2`, a query only reaches `"error"` after 3 failed attempts in a row. A
  later successful fetch (refocus, reconnect, Retry) clears it.
- **Network failure only.** `isNetworkFailure()`
  ([`lib/postgrest-error.ts`](../apps/supplystash/lib/postgrest-error.ts)) reads the error's code.
  A refusal from a server that answered (an RLS denial, a missing row) would name the wrong
  cause, so it does not count. Shapes under `.throwOnError()`, checked in postgrest-js 2.112:

  | Case                                                       | Rejects with        | `code`      | Counts |
  | ---------------------------------------------------------- | ------------------- | ----------- | ------ |
  | Fetch throws (no route, DNS, a captive portal cutting TLS) | the raw `TypeError` | none        | Yes    |
  | Non-JSON error body (portal redirect page, proxy HTML 5xx) | `PostgrestError`    | `undefined` | Yes    |
  | Non-JSON 200 body (a portal's login page)                  | `PostgrestError`    | `""`        | Yes    |
  | PostgREST cannot reach Postgres                            | `PostgrestError`    | `PGRST0xx`  | Yes    |
  | Postgres connection exception                              | `PostgrestError`    | `08xxx`     | Yes    |
  | Anything else (RLS, constraint, JWT, request errors)       | `PostgrestError`    | other       | No     |

  The last two "Yes" rows are matched by pattern, not a list: PostgREST group 0 is "connection
  with the database", and SQLSTATE class 08 is "connection exception".

- **Offline wins.** Going offline pauses queries but keeps their last error, so without the
  `useIsOnline()` check both strips would show.
- **Retry** refetches every query `isUnreachableQuery` matches. It shows _"Retrying…"_ and is
  disabled while any of them is fetching, including a refetch that focus or reconnect started.
- **No data, no bar during a refetch.** A query that never had data goes from `"error"` back to
  `"pending"` when it refetches, so the bar steps aside until that fetch fails too. The screen
  shows its own loading state meanwhile. With saved data, the query stays in `"error"` and the
  bar stays up.
- **Same strip as the offline banner** (`bg-card`, amber icon, pads the top inset). Unlike the
  banner, the message, not the whole strip, is the `accessible` element: an `accessible` parent
  hides its children from screen readers, and Retry must stay reachable.
- **Known limit: a hanging request shows the bar late.** postgrest-js retries a failed GET 3
  times (1s, 2s, 4s) under TanStack's 3 attempts, so one refetch is up to 12 requests. A request
  that fails fast puts the bar up in about 25s. One that hangs waits for the iOS default timeout
  (60s) each time, about 12 minutes in all. A read timeout would fix this and is not built yet.

## Blocked controls

The strips above are app-wide. A control whose action needs the server is blocked **per
control**, before the tap (§5.1: refusals are pre-emptive, never attempted-then-refused). Wrap it
in [`BlockedControl`](../apps/supplystash/components/blocked-control.tsx); never hand-roll
`disabled={!isOnline}`.

```tsx
<BlockedControl action="ledger-write" label="Add 24 Red Bull">
  {(disabled) => (
    <Button disabled={disabled} onPress={add}>
      <Text>Add 24</Text>
    </Button>
  )}
</BlockedControl>
```

| Action                                                      | Offline, native     | Offline, web | Unreachable |
| ----------------------------------------------------------- | ------------------- | ------------ | ----------- |
| `ledger-write`, `membership`, `barcode`, `photo`, `history` | Blocked             | Blocked      | Blocked     |
| `check-off`                                                 | Allowed (it queues) | Blocked      | Blocked     |

| Cause       | Reason                                                 |
| ----------- | ------------------------------------------------------ |
| Offline     | _"Cannot perform that action while app is offline."_   |
| Unreachable | _"Unable to perform that action, server unreachable."_ |

- **The rules** live in `getBlockedReason()`
  ([`lib/blocked-reason.ts`](../apps/supplystash/lib/blocked-reason.ts)), a pure function.
  `useBlockedReason(action)`
  ([`hooks/use-blocked-reason.ts`](../apps/supplystash/hooks/use-blocked-reason.ts)) feeds it
  `useIsOnline()`, `useIsServerUnreachable()`, and the platform. Use the hook directly only where
  a wrapper does not fit.
- **Unreachable blocks too, check-off included.** The app is online, so TanStack does not pause
  the write: it would fire and fail. Offline wins when both are true, as with the strips.
- **Web check-off is blocked offline.** Web persists nothing, so a queued check-off would vanish
  on refresh (§5.4).
- **The reason shows as a toast on tap.** `label` names the control while it is blocked.
- **Layout:** `className` styles the wrapper (`self-start`, `flex-1`). Wrap the whole row for a
  small control like a checkbox: the tap target is the wrapper's size.
- **Fixture:** Settings → _Blocked controls_
  ([`app/(app)/blocked-controls.tsx`](<../apps/supplystash/app/(app)/blocked-controls.tsx>)), one
  row per action, with a _Simulate offline_ toggle. Delete it once design signs off.

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
- [`lib/__tests__/postgrest-error.test.ts`](../apps/supplystash/lib/__tests__/postgrest-error.test.ts):
  one case per error shape in the unreachable-bar table.
- [`hooks/__tests__/use-is-server-unreachable.test.tsx`](../apps/supplystash/hooks/__tests__/use-is-server-unreachable.test.tsx)
  and [`components/__tests__/server-unreachable-bar.test.tsx`](../apps/supplystash/components/__tests__/server-unreachable-bar.test.tsx):
  the captive-portal case (online, requests failing), recovery, offline priority, and Retry.
- [`lib/__tests__/blocked-reason.test.ts`](../apps/supplystash/lib/__tests__/blocked-reason.test.ts):
  the blocking matrix, every action by connection state by platform.
- [`hooks/__tests__/use-blocked-reason.test.tsx`](../apps/supplystash/hooks/__tests__/use-blocked-reason.test.tsx)
  and [`components/__tests__/blocked-control.test.tsx`](../apps/supplystash/components/__tests__/blocked-control.test.tsx):
  re-render on connection changes, the disabled child, the toast instead of the action, and the
  screen-reader hint.
