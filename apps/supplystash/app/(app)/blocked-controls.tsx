import { onlineManager } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ScanBarcodeIcon } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { AppSafeScrollScreen } from "@/components/app-safe-screen";
import { BlockedControl } from "@/components/blocked-control";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useIsOnline } from "@/hooks/use-is-online";
import { useIsServerUnreachable } from "@/hooks/use-is-server-unreachable";

// TODO: delete this screen (and its link on the Settings tab) once the designer
// has signed off on the blocked states (STASH-42) and real screens use
// BlockedControl. Until then it is the on-device reference for every action.

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="gap-2">
    <Text className="text-sm text-muted-foreground">{title}</Text>
    {children}
  </View>
);

const ConnectionStatus = () => {
  const isOnline = useIsOnline();
  const isUnreachable = useIsServerUnreachable();
  const status = !isOnline ? "Offline" : isUnreachable ? "Server unreachable" : "Connected";

  return (
    <View className="gap-2 rounded-lg bg-card p-3">
      <Text className="font-semibold text-card-foreground">{status}</Text>
      {/* Overrides the real reading only until the next network change. To see
          the unreachable state, point the app at a Supabase that is down. */}
      <Button variant="outline" size="sm" onPress={() => onlineManager.setOnline(!isOnline)}>
        <Text>{isOnline ? "Simulate offline" : "Simulate online"}</Text>
      </Button>
    </View>
  );
};

const CheckOffRow = () => {
  const [checked, setChecked] = useState(false);

  // The whole row is wrapped, not just the 16px box, so the cover is easy to hit.
  return (
    <BlockedControl action="check-off" label="Check off Red Bull">
      {(disabled) => (
        <View className="flex-row items-center gap-3 py-2">
          <Checkbox checked={checked} onCheckedChange={setChecked} disabled={disabled} />
          <Label disabled={disabled} onPress={() => setChecked(!checked)}>
            Red Bull
          </Label>
        </View>
      )}
    </BlockedControl>
  );
};

const BlockedControls = () => (
  <View className="w-full gap-6">
    <ConnectionStatus />
    <Row title="ledger-write">
      <BlockedControl action="ledger-write" label="Add 24 Red Bull">
        {(disabled) => (
          <Button disabled={disabled}>
            <Text>Add 24</Text>
          </Button>
        )}
      </BlockedControl>
    </Row>
    <Row title="membership">
      <BlockedControl action="membership" label="Invite member">
        {(disabled) => (
          <Button variant="secondary" disabled={disabled}>
            <Text>Invite member</Text>
          </Button>
        )}
      </BlockedControl>
    </Row>
    <Row title="barcode (icon only)">
      <BlockedControl action="barcode" label="Scan barcode" className="self-start">
        {(disabled) => (
          <Button variant="outline" size="icon" disabled={disabled} aria-label="Scan barcode">
            <Icon as={ScanBarcodeIcon} />
          </Button>
        )}
      </BlockedControl>
    </Row>
    <Row title="photo">
      <BlockedControl action="photo" label="Add photo">
        {(disabled) => (
          <Button variant="outline" disabled={disabled}>
            <Text>Add photo</Text>
          </Button>
        )}
      </BlockedControl>
    </Row>
    <Row title="history">
      <BlockedControl action="history" label="View history" className="self-start">
        {(disabled) => (
          <Button variant="link" disabled={disabled}>
            <Text>View history</Text>
          </Button>
        )}
      </BlockedControl>
    </Row>
    <Row title="check-off (native: never blocked offline)">
      <CheckOffRow />
    </Row>
  </View>
);

// Pushed onto the (app) stack above the tabs, with the native header opted
// back in for the back button, same as theme-swatches.tsx.
export default function BlockedControlsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Blocked controls" }} />
      <AppSafeScrollScreen edges={["bottom", "left", "right"]} contentContainerClassName="p-4">
        <BlockedControls />
      </AppSafeScrollScreen>
    </>
  );
}
