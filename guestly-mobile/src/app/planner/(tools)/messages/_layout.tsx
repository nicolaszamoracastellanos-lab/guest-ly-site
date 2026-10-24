import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// The planner's Messages tool: the inbox, and one thread on its own screen when
// there is a single pane (two panes show both on the inbox route).
export const unstable_settings = { initialRouteName: "index" };

export default function PlannerMessagesStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
