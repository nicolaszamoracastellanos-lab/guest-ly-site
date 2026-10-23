// Boda / Wedding became Herramientas / Tools in build 13. The route stays for
// old pushes and links, and opens Tools.

import React from "react";
import { Redirect } from "expo-router";

export default function PlannerWeddingRedirect() {
  return <Redirect href="/planner/tools" />;
}
