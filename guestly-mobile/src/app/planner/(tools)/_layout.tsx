import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// Planner Tools tab: the hub and every tool. Expo Router 58 redirects away from hidden tab routes, so every
// section lives inside the stack of the tab that opens it. The folder is a
// route group: URLs do not change.
export const unstable_settings = { initialRouteName: "tools" };

export default function PlannerToolsStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
