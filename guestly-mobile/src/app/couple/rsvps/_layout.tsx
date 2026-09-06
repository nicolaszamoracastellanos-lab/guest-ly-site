import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

export default function RsvpsStack() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="record" options={{ presentation: "modal" }} />
    </Stack>
  );
}
