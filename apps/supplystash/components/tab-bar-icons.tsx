import type { LucideIcon } from "lucide-react-native";
import type { ColorValue } from "react-native";

import { PlusIcon } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** What React Navigation passes to a `tabBarIcon` function. */
export type TabBarIconProps = {
  focused: boolean;
  color: ColorValue;
  size: number;
};

// The active and inactive tints are both greys on a grey bar, so tint alone is
// a weak signal. The active tab also gets a lighter pill behind its icon: a
// shape cue that holds up in both themes and through palette changes.
/** A tab icon that sits on a lighter pill when its tab is focused. */
export const TabBarIcon = ({
  icon,
  focused,
  color,
  size,
}: TabBarIconProps & { icon: LucideIcon }) => (
  <View
    className={cn(
      "items-center justify-center rounded-full px-4 py-0.5",
      focused && "bg-background",
    )}
  >
    <Icon as={icon} color={color} size={size} />
  </View>
);

// Add Item is the one action in the bar, so it is the one splash of color: a
// filled disc the size of the other icons, with the plus cut out of it. Lucide
// has no filled circle-plus, so the disc is a view. `info` is a stand-in until
// the designer settles on a brand token for it.
//
// The plus gets its color as a prop, like the other tab icons do. A color class
// on the icon did not take effect on web.
const AddItemDisc = ({ size }: Pick<TabBarIconProps, "size">) => {
  const plusColor = useCSSVariable("--color-info-foreground");

  return (
    <View
      className="items-center justify-center rounded-full bg-info"
      style={{ width: size, height: size }}
    >
      <Icon
        as={PlusIcon}
        color={typeof plusColor === "string" ? plusColor : undefined}
        size={size * 0.7}
        strokeWidth={2.5}
      />
    </View>
  );
};

// The wrapper matches the pill's padding so the icon lines up with its
// neighbors; it never shows the pill, because the slot is never the focused tab.
// React Navigation calls this as a plain function, so the hook lives in
// AddItemDisc, a real component.
export const AddItemTabIcon = ({ size }: Pick<TabBarIconProps, "size">) => (
  <View className="items-center justify-center px-4 py-0.5">
    <AddItemDisc size={size} />
  </View>
);
