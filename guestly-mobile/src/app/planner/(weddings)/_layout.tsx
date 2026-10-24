import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// Weddings tab: the portfolio list and one wedding's summary share this stack.
export const unstable_settings = { initialRouteName: "weddings" };

export default function WeddingsStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
