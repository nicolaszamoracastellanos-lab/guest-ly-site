import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/ui/tokens";

// A real stack for this section. Without a layout the route was named
// "runsheet/index", so the tab layout's hidden "runsheet" entry matched nothing
// (core review P1-7). Record screens are pushed: native swipe back, and a
// detail is unmounted on pop so it never keeps the previous record's form.
export default function PlannerRunsheetStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />;
}
