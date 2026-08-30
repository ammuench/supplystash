// Canonical query-key factory. See docs/query-keys.md for the rules.
//
// Every home-scoped key carries homeId as element 2. Never inline a key array
// in a hook or a mutation — import queryKeys and call it, so the Realtime bridge
// invalidates the exact same key.

export const queryKeys = {
  items: (homeId: string) => ["items", homeId] as const,
  categories: (homeId: string) => ["categories", homeId] as const,
  shoppingList: (homeId: string) => ["shoppingList", homeId] as const,
  itemHistory: (homeId: string, itemId: string) => ["itemHistory", homeId, itemId] as const,
  // Not home-scoped: this IS the list of homes the current user belongs to.
  homes: () => ["homes"] as const,
} as const;
