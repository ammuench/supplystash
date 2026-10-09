import { View } from "react-native";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import {
  isThemePreference,
  type ThemePreference,
  useThemePreference,
} from "@/lib/theme-preference";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Tabs without TabsContent renders as a segmented control.
export const ThemePicker = ({ className }: { className?: string }) => {
  const { preference, setPreference } = useThemePreference();

  return (
    <View className={cn("items-center gap-2", className)}>
      <Text className="text-sm text-muted-foreground">Appearance</Text>
      <Tabs
        value={preference}
        onValueChange={(value) => {
          // rn-primitives types the value as a plain string.
          if (isThemePreference(value)) {
            void setPreference(value);
          }
        }}
      >
        <TabsList>
          {OPTIONS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              <Text>{label}</Text>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </View>
  );
};
