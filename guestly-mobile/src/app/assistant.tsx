// The pushed Coordinator chat (planner, and old links and notifications). The
// couple's Coordinator is a tab now: /couple/coordinator.

import React from "react";
import { Redirect } from "expo-router";
import { useUserSession } from "@/lib/session";
import { AssistantView } from "@/features/assistant/AssistantView";

export default function AssistantScreen() {
  const user = useUserSession();
  if (user && user.me.surface !== "planner") return <Redirect href="/couple/coordinator" />;
  return <AssistantView />;
}
