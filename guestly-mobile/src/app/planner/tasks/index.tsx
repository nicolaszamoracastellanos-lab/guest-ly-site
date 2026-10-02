// The planner's task board moved into Pendientes / To do (build 12, plan b,
// N10: tasks lived in three places). Pushes, briefing rows and portal links
// still open /planner/tasks: they land on Pendientes, where the same board
// is (filters, mark done, hold to move status, add a task). A task itself
// (/planner/tasks/{id}) and the new task form (/planner/tasks/new) stay here.
import React from "react";
import { Redirect } from "expo-router";

export default function PlannerTasksRedirect() {
  return <Redirect href="/planner/requests" />;
}
