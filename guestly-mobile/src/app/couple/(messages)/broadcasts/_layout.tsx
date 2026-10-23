import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// A record opened by a link or a notification lands on top of this stack's
// list, never as its only screen (review fix, build 12). An in-app push from
// another tab can still be the only screen (Back then returns to that tab,
// lib/nav useSafeBack); the tab bar and a wedding switch reset such a stack
// to its list (ui/TabBar resetStackToRoot).
export const unstable_settings = { initialRouteName: "index" };

// A real stack for this section: every record screen is pushed (native swipe
// back, unmounted on pop), so a detail never keeps the previous record's form.
export default function BroadcastsStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
