// One task on the board shared with the planner.
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SharedTaskScreen } from "@/features/tasks/ui";

export default function CoupleBoardTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SharedTaskScreen surface="couple" id={id} />;
}
