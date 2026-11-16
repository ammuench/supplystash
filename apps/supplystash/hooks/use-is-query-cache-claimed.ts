import { useEffect, useSyncExternalStore } from "react";

import { claimAppQueryCache } from "@/lib/query-cache-owner";

// Which user the read cache has been claimed for. RootNavigator renders no
// screen for a signed-in user until it matches, so neither the first screen
// nor a sign-in's first fetch can see another account's rows left on disk by
// an interrupted sign-out wipe. See docs/persistence.md.
//
// Module-level so every consumer (the navigator and the splash) shares one
// claim and flips on the same render.

let requested: string | null = null;
let claimedFor: string | null = null;
// Bumped by every request. A claim only marks the cache claimed if no request
// came after it: after A → B → A, the first A claim finishing must not open
// the gate while B's and the second A's claims (which clear the cache) are
// still queued. Never reset, so a claim from before a test reset cannot match.
let generation = 0;
const listeners = new Set<() => void>();

// One at a time: a claim that wipes must finish before the next one reads the
// owner, or the second would match the owner the first is about to replace.
// Claims never reject.
let claims: Promise<void> = Promise.resolve();

const setClaimedFor = (userId: string | null) => {
  claimedFor = userId;
  listeners.forEach((listener) => listener());
};

const request = (userId: string | null) => {
  if (userId === requested) {
    return;
  }

  requested = userId;
  generation += 1;
  const thisRequest = generation;
  // Signing out, or switching user, drops the old claim at once. The same
  // user signing back in claims again: one read when nothing changed.
  setClaimedFor(null);
  if (!userId) {
    return;
  }

  claims = claims
    .then(() => claimAppQueryCache(userId))
    .then(() => {
      // A sign-out or another sign-in while this ran has moved on.
      if (generation === thisRequest) {
        setClaimedFor(userId);
      }
    });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** True once the read cache has been claimed for `userId`. False while signed out. */
export const useIsQueryCacheClaimed = (userId: string | undefined) => {
  useEffect(() => {
    request(userId ?? null);
  }, [userId]);

  const claimed = useSyncExternalStore(subscribe, () => claimedFor);

  return userId !== undefined && claimed === userId;
};

// Module state outlives a test's render.
export const resetQueryCacheClaimForTests = () => {
  requested = null;
  claimedFor = null;
  claims = Promise.resolve();
  listeners.clear();
};
