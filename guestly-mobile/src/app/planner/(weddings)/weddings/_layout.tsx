import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// A summary opened by a link lands on top of the list, never as its only screen.
export const unstable_settings = { initialRouteName: "index" };

export default function WeddingsInnerStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
