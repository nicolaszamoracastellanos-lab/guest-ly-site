import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

export default function GuestsStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
      <Stack.Screen name="index" />
      {/* The guest card and add guest are full-height sheets (M8, M9). */}
      <Stack.Screen name="[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="new" options={{ presentation: "modal" }} />
      {/* "Edit RSVP" opens over the guest card and returns to it. */}
      <Stack.Screen name="record" options={{ presentation: "modal" }} />
      <Stack.Screen name="import" />
    </Stack>
  );
}
