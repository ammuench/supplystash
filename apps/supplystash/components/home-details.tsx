import { View } from "react-native";

import type { Home } from "@/state/homes";

import { Text } from "@/components/ui/text";

/**
 * The body of a home's page, shared by the home details screen and by the Home
 * tab when the user has only one home. The caller shows the name, as a header
 * or a title. A placeholder until STASH-58 designs the real page.
 *
 * <HomeDetails home={home} />
 */
export const HomeDetails = ({ home }: { home: Home }) => (
  <View className="gap-2">
    <Text>Members: {home.memberCount}</Text>
    <Text>
      Your role: <Text className="capitalize">{home.role}</Text>
    </Text>
  </View>
);
