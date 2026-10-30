import type { Persister } from "@tanstack/query-persist-client-core";

// Web version. Metro resolves lib/paused-mutation-persister.native.ts on
// iOS/Android and falls back to this file on web, where nothing is persisted.
// Kept as a separate file so expo-sqlite never enters the web bundle. tsc
// type-checks imports against this file, so it declares the native type.
export const pausedMutationPersister: Persister | undefined = undefined;
