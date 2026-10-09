import { Platform, TextInput } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/utils";

function Input({
  className,
  placeholderTextColor,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  // Native placeholder color goes through the prop, not a `placeholder:` class:
  // on Android the class-derived color goes stale when the theme changes while
  // the app is open (STASH-32). `useCSSVariable` re-renders on theme change.
  const mutedForeground = useCSSVariable("--color-muted-foreground");

  return (
    <TextInput
      className={cn(
        "flex h-10 w-full min-w-0 flex-row items-center rounded-md border border-input bg-background px-3 py-1 text-base leading-5 text-foreground shadow-sm shadow-black/5 sm:h-9 dark:bg-input/30",
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({ web: "disabled:pointer-events-none disabled:cursor-not-allowed" }),
          ),
        Platform.select({
          web: cn(
            "transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground md:text-sm",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          ),
        }),
        className,
      )}
      placeholderTextColor={
        placeholderTextColor ??
        (Platform.OS !== "web" && typeof mutedForeground === "string" ? mutedForeground : undefined)
      }
      {...props}
    />
  );
}

export { Input };
