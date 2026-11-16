// Web version. Metro resolves lib/query-cache-owner.native.ts on iOS/Android.
// Web keeps nothing on disk, so there is no cache to claim. Kept as a separate
// file so expo-sqlite never enters the web bundle.
export const claimAppQueryCache: (userId: string) => Promise<void> = async () => {};
