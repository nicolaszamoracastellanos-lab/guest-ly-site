import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// Guest messages tab (SDK 58): conversations and broadcasts share this stack
// (see (tools)/_layout.tsx for why sections live inside the tab).
export const unstable_settings = { initialRouteName: "messages" };

export default function MessagesStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
