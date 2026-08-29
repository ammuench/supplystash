import * as React from "react";
import { View } from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { cn } from "@/lib/utils";

// `withUniwind` without an option map auto-maps every `*ClassName` prop onto its
// matching `*Style` prop (`className` -> `style`, `contentContainerClassName` ->
// `contentContainerStyle`). Uniwind only patches react-native's own exports, so
// third-party views need this wrapper to understand `className`.
const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledKeyboardAvoidingView = withUniwind(KeyboardAvoidingView);
const StyledKeyboardAwareScrollView = withUniwind(KeyboardAwareScrollView);

type SafeAreaEdges = React.ComponentProps<typeof SafeAreaView>["edges"];

export type AppSafeScreenProps = React.ComponentProps<typeof SafeAreaView> &
  React.RefAttributes<typeof SafeAreaView> & {
    /**
     * Lift content above the keyboard. Defaults to `true` — the provider is inert
     * until a keyboard actually appears, so this costs nothing on screens without
     * inputs.
     */
    keyboardAvoiding?: boolean;
  };

/**
 * The default screen container: safe-area padding plus keyboard avoidance.
 *
 * `edges` comes straight from `SafeAreaView`. Screens sitting under a non-transparent
 * `Stack` header should pass `edges={["bottom", "left", "right"]}`, since the header
 * already covers the top inset.
 *
 * @component
 * @example
 * ```tsx
 * <AppSafeScreen className="gap-4 p-4">
 *   <Text>Hello</Text>
 * </AppSafeScreen>
 * ```
 */
export const AppSafeScreen = ({
  className,
  keyboardAvoiding = true,
  children,
  ...props
}: AppSafeScreenProps) => {
  // `className` lands on the inner container, not the SafeAreaView: layout classes
  // like `items-center` or `gap-8` have to apply to the actual content, and the
  // SafeAreaView's only child is the keyboard view.
  const contentClassName = cn("flex-1", className);

  return (
    <StyledSafeAreaView className="flex-1 bg-background" {...props}>
      {keyboardAvoiding ? (
        <StyledKeyboardAvoidingView behavior="padding" className={contentClassName}>
          {children}
        </StyledKeyboardAvoidingView>
      ) : (
        <View className={contentClassName}>{children}</View>
      )}
    </StyledSafeAreaView>
  );
};

export type AppSafeScrollScreenProps = React.ComponentProps<typeof KeyboardAwareScrollView> & {
  /** Forwarded to the outer `SafeAreaView`. */
  edges?: SafeAreaEdges;
  /** Classes for the outer safe-area container, not the scroller. */
  containerClassName?: string;
};

/**
 * Scrolling counterpart to {@link AppSafeScreen}. Built on `KeyboardAwareScrollView`,
 * which scrolls the focused input into view on its own — no manual inset math.
 *
 * Style the scroll content with `contentContainerClassName`; `className` styles the
 * scroller itself.
 *
 * @component
 * @example
 * ```tsx
 * <AppSafeScrollScreen contentContainerClassName="gap-4 p-4">
 *   <TextInput />
 * </AppSafeScrollScreen>
 * ```
 */
export const AppSafeScrollScreen = ({
  edges,
  containerClassName,
  className,
  bottomOffset = 16,
  keyboardShouldPersistTaps = "handled",
  ...props
}: AppSafeScrollScreenProps) => {
  return (
    <StyledSafeAreaView edges={edges} className={cn("flex-1 bg-background", containerClassName)}>
      <StyledKeyboardAwareScrollView
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        className={cn("flex-1", className)}
        {...props}
      />
    </StyledSafeAreaView>
  );
};
