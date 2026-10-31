import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// The couple's site pages as one stack: the route is named "site", which the
// guest tab layout declares (without this file expo-router warned "No route
// named site"), and each page opened from More or the site is pushed, with
// native swipe back.
export default function GuestSiteStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
