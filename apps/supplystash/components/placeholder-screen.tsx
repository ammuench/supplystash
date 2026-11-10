import type { AppSafeScreenProps } from "@/components/app-safe-screen";

import { AppSafeScreen } from "@/components/app-safe-screen";
import { Text } from "@/components/ui/text";

type PlaceholderScreenProps = Pick<AppSafeScreenProps, "edges"> & {
  /** The page name, shown centered. */
  title: string;
};

// Stands in for a page that has no real design yet, so every tab-bar slot has
// somewhere to land. Delete each use as its real screen arrives.
export const PlaceholderScreen = ({ title, edges }: PlaceholderScreenProps) => (
  <AppSafeScreen className="items-center justify-center p-4" edges={edges}>
    <Text className="text-xl font-semibold">{title}</Text>
  </AppSafeScreen>
);
