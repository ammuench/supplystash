import type { AsyncStorage } from "@tanstack/query-persist-client-core";
import type { QueryClient } from "@tanstack/react-query";

import { capture } from "@/lib/analytics";
import { queryCacheRestored } from "@/lib/query-cache-restore";
import { queryCacheStorage } from "@/lib/query-cache-storage";
import { wipeAppQueryCache } from "@/lib/query-cache-wipe";
import { openQueryCacheWrites } from "@/lib/query-cache-write-gate";
import { queryClient } from "@/lib/query-client";
import { QUERY_CACHE_OWNER_KEY } from "@/lib/query-persister-config";

// Native version. Metro resolves lib/query-cache-owner.ts on web, where
// nothing is persisted.
//
// The sign-out wipe is not awaited and not retried, so a kill or a failed
// delete leaves the old account's rows on disk, and none of the persisted
// roots carries a user id (docs/query-keys.md rule 4). Recording whose cache
// it is, and wiping on a mismatch before the session is applied, keeps those
// rows from reaching another account. See docs/persistence.md.

const reportFailure = (error: unknown) => {
  capture("query_cache_claim_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
};

export const claimQueryCache = async ({
  userId,
  storage,
  client,
  wipe,
}: {
  userId: string;
  storage: AsyncStorage<string>;
  client: QueryClient;
  wipe: () => Promise<boolean>;
}) => {
  // An unreadable owner counts as someone else's: wiping costs a refetch,
  // keeping costs another account's data.
  const owner = await Promise.resolve(storage.getItem(QUERY_CACHE_OWNER_KEY)).catch(
    (error: unknown) => {
      reportFailure(error);
      return null;
    },
  );
  if (owner === userId) {
    return;
  }

  // Memory first: the boot pass may already have restored the rows, and this
  // also drops restored paused mutations that have not replayed yet.
  client.clear();
  const isWiped = await wipe();
  // The wipe closes the read cache to writes, and this user is signed in.
  openQueryCacheWrites();

  // Only once the rows are gone. After a failed wipe the old owner stays, so
  // the next claim, at the next sign-in or launch, wipes again. The wipe
  // reports its own failure.
  if (isWiped) {
    await storage.setItem(QUERY_CACHE_OWNER_KEY, userId);
  }
};

// Waits for the boot pass, or its writes to memory would land after the clear.
// Never rejects: SessionProvider holds the splash on it.
export const claimAppQueryCache = async (userId: string) => {
  await queryCacheRestored;

  try {
    await claimQueryCache({
      userId,
      storage: queryCacheStorage,
      client: queryClient,
      wipe: wipeAppQueryCache,
    });
  } catch (error) {
    reportFailure(error);
  }
};
