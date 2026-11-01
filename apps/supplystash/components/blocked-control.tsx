import type { ReactNode } from "react";

import { Platform, Pressable, View } from "react-native";

import type { BlockedAction } from "@/lib/blocked-reason";

import { useBlockedReason } from "@/hooks/use-blocked-reason";
import { toastInfo } from "@/lib/toast";
import { cn } from "@/lib/utils";

type BlockedControlProps = {
  action: BlockedAction;
  /** What the control does, read by screen readers while it is blocked. */
  label: string;
  className?: string;
  children: (disabled: boolean) => ReactNode;
};

/**
 * Wraps a control whose action needs the server, so it is disabled before the
 * tap rather than tried and refused (architecture §5.1). While blocked, the
 * child renders disabled and a cover over it shows the reason in a toast when
 * tapped. The wrapper View is always there, so the child keeps its state when
 * blocking starts or stops. Wrap the whole row for a small control like a
 * checkbox, so the cover is easy to hit. See docs/connectivity.md.
 */
export const BlockedControl = ({ action, label, className, children }: BlockedControlProps) => {
  const state = useBlockedReason(action);

  return (
    <View className={cn("relative", className)}>
      {/* Hidden while blocked, so screen readers find only the cover, which
          carries the reason as its hint. react-native-web drops
          `accessibilityHint`, so on web the reason joins the label instead.
          Android turns `accessibilityState.disabled` into `setEnabled(false)`,
          which drops touches, so taps would fall through to the disabled child.
          There the hint carries the blocked state alone. */}
      <View aria-hidden={state.blocked}>{children(state.blocked)}</View>
      {state.blocked && (
        <Pressable
          className="absolute inset-0"
          role="button"
          accessibilityLabel={Platform.OS === "web" ? `${label}. ${state.reason}` : label}
          accessibilityHint={state.reason}
          accessibilityState={Platform.OS === "android" ? undefined : { disabled: true }}
          onPress={() => toastInfo(state.reason, `blocked:${state.reason}`)}
        />
      )}
    </View>
  );
};
