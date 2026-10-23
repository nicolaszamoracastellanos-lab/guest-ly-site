import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// Guests tab (SDK 58): the guest list and the RSVP screens share this stack.
export const unstable_settings = { initialRouteName: "guests" };

export default function GuestsStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
