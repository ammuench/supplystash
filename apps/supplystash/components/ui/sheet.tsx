import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheetModal,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as React from "react";
import { Platform, View, type ViewProps } from "react-native";
import { withUniwind } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// Uniwind only patches react-native's own exports, so every `@gorhom/bottom-sheet`
// component ignores `className` until it goes through `withUniwind`. Called without an
// option map it auto-maps each `*ClassName` prop onto its matching `*Style` prop, which
// covers gorhom's whole style surface in one go:
//   className -> style                              backgroundClassName -> backgroundStyle
//   handleClassName -> handleStyle                  containerClassName -> containerStyle
//   handleIndicatorClassName -> handleIndicatorStyle
//   contentContainerClassName -> contentContainerStyle
const StyledBottomSheetModal = withUniwind(BottomSheetModal);
const StyledBottomSheetView = withUniwind(BottomSheetView);
const StyledBottomSheetScrollView = withUniwind(BottomSheetScrollView);
const StyledBottomSheetFlatList = withUniwind(BottomSheetFlatList);
const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);
const StyledBottomSheetBackdrop = withUniwind(BottomSheetBackdrop);

export type SheetRef = React.ComponentRef<typeof BottomSheetModal>;

export type SheetBackdropProps = BottomSheetBackdropProps & { className?: string };

/**
 * The dimmed scrim behind an open {@link Sheet}. Gorhom ships no backdrop by default, so
 * {@link Sheet} wires this in automatically — pass your own `backdropComponent` to override.
 *
 * @component
 */
export const SheetBackdrop = ({ className, ...props }: SheetBackdropProps) => (
  <StyledBottomSheetBackdrop
    appearsOnIndex={0}
    disappearsOnIndex={-1}
    className={cn("bg-black/50", className)}
    {...props}
  />
);

export type SheetProps = React.ComponentProps<typeof StyledBottomSheetModal> &
  React.RefAttributes<SheetRef>;

/**
 * A themed bottom sheet, presented imperatively via its ref.
 *
 * Built on `BottomSheetModal`, so it requires the `BottomSheetModalProvider` mounted in
 * `app/_layout.tsx`. Every gorhom prop still applies; the surface, handle and backdrop
 * just come pre-styled from the uniwind theme.
 *
 * @component
 * @example
 * ```tsx
 * const sheet = React.useRef<SheetRef>(null);
 *
 * <Button onPress={() => sheet.current?.present()}><Text>Open</Text></Button>
 *
 * <Sheet ref={sheet} snapPoints={["50%", "90%"]}>
 *   <SheetView className="gap-4 p-4">
 *     <SheetHeader>
 *       <SheetTitle>Add item</SheetTitle>
 *       <SheetDescription>Stock a new item into this home.</SheetDescription>
 *     </SheetHeader>
 *   </SheetView>
 * </Sheet>
 * ```
 */
export const Sheet = ({
  backgroundClassName,
  handleIndicatorClassName,
  backdropComponent = SheetBackdrop,
  keyboardBehavior = "interactive",
  keyboardBlurBehavior = "restore",
  android_keyboardInputMode = "adjustResize",
  ...props
}: SheetProps) => (
  <StyledBottomSheetModal
    backgroundClassName={cn(
      "rounded-t-2xl border-t border-border bg-background",
      backgroundClassName,
    )}
    handleIndicatorClassName={cn("bg-muted-foreground/40", handleIndicatorClassName)}
    backdropComponent={backdropComponent}
    keyboardBehavior={keyboardBehavior}
    keyboardBlurBehavior={keyboardBlurBehavior}
    android_keyboardInputMode={android_keyboardInputMode}
    {...props}
  />
);

/**
 * Non-scrolling content container for a {@link Sheet}. Pair with `enableDynamicSizing`
 * to have the sheet measure itself against this view.
 *
 * @component
 */
export const SheetView = ({
  className,
  ...props
}: React.ComponentProps<typeof StyledBottomSheetView>) => (
  <StyledBottomSheetView className={cn("flex-1", className)} {...props} />
);

/**
 * Scrolling content container for a {@link Sheet}. Use this rather than a plain
 * `ScrollView` — it hands the scroll gesture back to the sheet at the top of the list so
 * dragging still moves between snap points.
 *
 * Style the scroll content with `contentContainerClassName`; `className` styles the scroller.
 *
 * @component
 */
export const SheetScrollView = ({
  className,
  ...props
}: React.ComponentProps<typeof StyledBottomSheetScrollView>) => (
  <StyledBottomSheetScrollView className={cn("flex-1", className)} {...props} />
);

/**
 * Virtualized counterpart to {@link SheetScrollView}, for long lists inside a sheet.
 *
 * @component
 */
export const SheetFlatList = StyledBottomSheetFlatList;

/**
 * Text input that keeps the sheet in sync with the keyboard. Matches the styling of
 * `components/ui/input.tsx` — use it instead of `Input` inside a {@link Sheet}.
 *
 * @component
 */
export const SheetTextInput = ({
  className,
  ...props
}: React.ComponentProps<typeof StyledBottomSheetTextInput>) => (
  <StyledBottomSheetTextInput
    className={cn(
      "flex h-10 w-full min-w-0 flex-row items-center rounded-md border border-input bg-background px-3 py-1 text-base leading-5 text-foreground shadow-sm shadow-black/5 sm:h-9 dark:bg-input/30",
      Platform.select({
        web: cn(
          "transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground md:text-sm",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        ),
        native: "placeholder:text-muted-foreground/50",
      }),
      className,
    )}
    {...props}
  />
);

/**
 * Title + description block for the top of a sheet. Mirrors `DialogHeader`.
 *
 * @component
 */
export const SheetHeader = ({ className, ...props }: ViewProps) => (
  <View className={cn("flex flex-col gap-2", className)} {...props} />
);

/**
 * Action row for the bottom of a sheet. Mirrors `DialogFooter`.
 *
 * @component
 */
export const SheetFooter = ({ className, ...props }: ViewProps) => (
  <View
    className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
    {...props}
  />
);

/**
 * @component
 */
export const SheetTitle = ({ className, ...props }: React.ComponentProps<typeof Text>) => (
  <Text
    className={cn("text-lg leading-none font-semibold text-foreground", className)}
    {...props}
  />
);

/**
 * @component
 */
export const SheetDescription = ({ className, ...props }: React.ComponentProps<typeof Text>) => (
  <Text className={cn("text-sm text-muted-foreground", className)} {...props} />
);

/**
 * Dismiss the enclosing sheet from within its own content.
 *
 * @example
 * ```tsx
 * const { dismiss } = useSheet();
 * ```
 */
export const useSheet = useBottomSheetModal;
