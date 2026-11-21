import type { Home } from "@/state/homes";

import { HomeSummaryCard } from "@/components/home-summary-card";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { cn } from "@/lib/utils";

export type HomeCardProps = {
  home: Home;
  /** Called when the card is pressed. The card does no navigation of its own. */
  onPress?: () => void;
  className?: string;
};

/**
 * One home in a list: its cover, stock pills, name and member count.
 *
 * Feedback is a dim, not PressableSurface's usual accent wash. The card's own
 * background has to travel with the shared transition into the details
 * header, and it covers the wash, which is drawn behind it.
 *
 * @component
 * @example
 * ```tsx
 * <HomeCard home={home} onPress={() => router.push(`/homes/${home.id}`)} />
 * ```
 */
export const HomeCard = ({ home, onPress, className }: HomeCardProps) => (
  <PressableSurface
    role="link"
    aria-label={home.name}
    className={cn("rounded-lg active:opacity-80 web:hover:opacity-90", className)}
    onPress={onPress}
  >
    <HomeSummaryCard home={home} />
  </PressableSurface>
);
