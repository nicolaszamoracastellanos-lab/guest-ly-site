import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

export default function RsvpStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
