import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// A real stack for this section: every record screen is pushed (native swipe
// back, unmounted on pop), so a detail never keeps the previous record's form.
export default function SettingsStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
