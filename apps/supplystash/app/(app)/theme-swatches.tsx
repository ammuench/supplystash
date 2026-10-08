import { Stack } from "expo-router";
import { View } from "react-native";

import { AppSafeScrollScreen } from "@/components/app-safe-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

// TODO: delete this screen (and its link on the Settings tab) once the designer
// has signed off on the palette (STASH-32) and the real Settings screen is
// built. Until then it is the on-device reference for checking every token in
// light and dark.

// Class strings are literal so Tailwind's scanner picks them up.
const SENTIMENTS = [
  {
    name: "destructive",
    solid: "bg-destructive",
    fg: "text-destructive-foreground",
    subtle: "bg-destructive/15",
    text: "text-destructive",
  },
  {
    name: "info",
    solid: "bg-info",
    fg: "text-info-foreground",
    subtle: "bg-info/15",
    text: "text-info",
  },
  {
    name: "warning",
    solid: "bg-warning",
    fg: "text-warning-foreground",
    subtle: "bg-warning/15",
    text: "text-warning",
  },
  {
    name: "success",
    solid: "bg-success",
    fg: "text-success-foreground",
    subtle: "bg-success/15",
    text: "text-success",
  },
];

const ThemeSwatches = () => (
  <View className="w-full gap-6">
    <View className="gap-2">
      <Text className="font-semibold">Surface stack</Text>
      <View className="gap-3 rounded-lg border border-border bg-background p-3">
        <Text>background · foreground</Text>
        <Text className="text-muted-foreground">background · muted-foreground</Text>
        <View className="gap-3 rounded-lg border border-border bg-card p-3">
          <Text className="text-card-foreground">card · card-foreground</Text>
          <Text className="text-muted-foreground">card · muted-foreground</Text>
          <View className="gap-1 rounded-lg border border-border bg-muted p-3">
            <Text>muted · foreground</Text>
            <Text className="text-muted-foreground">muted · muted-foreground</Text>
            <Text className="text-xs text-muted-foreground">
              (border on muted: check edge above)
            </Text>
          </View>
        </View>
      </View>
    </View>

    <View className="gap-2">
      <Text className="font-semibold">Sentiments</Text>
      {SENTIMENTS.map((s) => (
        <View key={s.name} className="flex-row gap-2">
          <View className={`flex-1 rounded-md p-3 ${s.solid}`}>
            <Text className={s.fg}>{s.name}</Text>
          </View>
          <View className={`flex-1 rounded-md p-3 ${s.subtle}`}>
            <Text className={s.text}>{s.name}/15</Text>
          </View>
        </View>
      ))}
    </View>

    <View className="gap-2">
      <Text className="font-semibold">Components</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button>
          <Text>Default</Text>
        </Button>
        <Button variant="secondary">
          <Text>Secondary</Text>
        </Button>
        <Button variant="outline">
          <Text>Outline</Text>
        </Button>
        <Button variant="destructive">
          <Text>Destructive</Text>
        </Button>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Badge>
          <Text>badge</Text>
        </Badge>
        <Badge variant="secondary">
          <Text>secondary</Text>
        </Badge>
        <Badge variant="destructive">
          <Text>destructive</Text>
        </Badge>
      </View>
      <Input placeholder="Input placeholder (muted-foreground)" />
    </View>
  </View>
);

// Pushed onto the (app) stack above the tabs. The (app) stack hides headers by
// default, so this screen opts back in: the native header supplies the back
// button (and iOS swipe-back), which keeps the screen from being a dead end.
export default function ThemeSwatchesScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Theme swatches" }} />
      <AppSafeScrollScreen edges={["bottom", "left", "right"]} contentContainerClassName="p-4">
        <ThemeSwatches />
      </AppSafeScrollScreen>
    </>
  );
}
