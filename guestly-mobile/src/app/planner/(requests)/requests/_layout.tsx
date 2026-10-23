import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// A record opened by a link or a notification lands on top of this stack's
// list, never as its only screen (review fix, build 12). An in-app push from
// another tab can still be the only screen (Back then returns to that tab,
// lib/nav useSafeBack); the tab bar and a wedding switch reset such a stack
// to its list (ui/TabBar resetStackToRoot).
export const unstable_settings = { initialRouteName: "index" };

// The Pendientes / To do tab (build 12). Its first screen is the list of my
// tasks and my requests to the couple; a request and the new-request form are
// pushed onto it. Build 11 presented them as modals: inside the tabs a modal
// covered the floating tab bar, so the docked "Send to the couple" and the
// reply box sat a tab bar's height above the bottom. Pushed, they keep the
// bar, dock right above it, ride the keyboard, and swipe back like every
// other record screen. Routes are unchanged (/planner/requests/{id},
// /planner/requests/new), so pushes and links still open them.
export default function PlannerRequestsStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
