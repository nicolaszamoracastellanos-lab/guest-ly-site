import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

export default function RequestsStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
