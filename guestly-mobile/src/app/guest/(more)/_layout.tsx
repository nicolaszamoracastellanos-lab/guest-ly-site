import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// Guest Info tab: the menu and the wedding site pages. Expo Router 58 redirects away from hidden tab routes, so every
// section lives inside the stack of the tab that opens it. The folder is a
// route group: URLs do not change.
export const unstable_settings = { initialRouteName: "more" };

export default function GuestMoreStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
