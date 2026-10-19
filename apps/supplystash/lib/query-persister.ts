import type { experimental_createQueryPersister } from "@tanstack/query-persist-client-core";

// Web version. Metro resolves lib/query-persister.native.ts on iOS/Android and
// falls back to this file on web, where the query cache is memory-only: a
// refresh refetches. Kept as a separate file, not a `Platform.OS` branch, so
// expo-sqlite and its wasm worker never enter the web bundle. tsc type-checks
// imports against this file, so it declares the native type.
export const queryPersister: ReturnType<typeof experimental_createQueryPersister> | undefined =
  undefined;
