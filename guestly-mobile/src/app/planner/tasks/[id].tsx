// One shared task from the planner's seat.
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SharedTaskScreen } from "@/features/tasks/ui";

export default function PlannerTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SharedTaskScreen surface="planner" id={id} />;
}
