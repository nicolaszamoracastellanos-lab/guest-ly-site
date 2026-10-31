import React from "react";
import { GeneralScreen } from "@/features/settings/screens/General";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's form.
export default function GeneralRoute() {
  return <GeneralScreen key={useTenantKey()} surface="planner" />;
}
