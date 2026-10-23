import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// Tools tab (SDK 58): the hub (tools.tsx) and every section it opens live in
// this one stack, inside the tab. Expo Router 58 redirects away from a HIDDEN
// tab route (`href: null` now means `hidden`), so sections can no longer be
// hidden tab screens. The folder name is a route group: URLs do not change
// (/couple/tools, /couple/budget, /couple/tasks/abc ...).
export const unstable_settings = { initialRouteName: "tools" };

export default function ToolsStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
