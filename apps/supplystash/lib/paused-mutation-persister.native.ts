import { createMutationPersister } from "@/lib/mutation-persister";
import { queryCacheStorage } from "@/lib/query-cache-storage";

// Native paused-mutation persister. One instance, shared by
// components/query-provider.native.tsx and the sign-out wipe: its writes and
// `removeClient` run through one queue, so a save still pending at sign-out
// cannot land after the delete. Metro resolves lib/paused-mutation-persister.ts
// on web.
export const pausedMutationPersister = createMutationPersister(queryCacheStorage);
