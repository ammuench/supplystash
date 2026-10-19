import type { QueryClient } from "@tanstack/react-query";

import { QueryClientProvider } from "@tanstack/react-query";

/** Web version. Metro resolves components/query-provider.native.tsx on
 * iOS/Android and falls back to this file on web, where nothing is persisted:
 * a paused mutation would vanish on refresh, so offline-capable writes are
 * disabled on web instead. Kept as a separate file so expo-sqlite never enters
 * the web bundle. See docs/persistence.md.
 */
export const QueryProvider = ({
  client,
  children,
}: {
  client: QueryClient;
  children: React.ReactNode;
}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
