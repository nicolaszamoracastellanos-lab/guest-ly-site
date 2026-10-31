import React from "react";
import { ConnectionsScreen } from "@/features/settings/screens/Connections";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's form.
export default function ConnectionsRoute() {
  return <ConnectionsScreen key={useTenantKey()} surface="planner" />;
}
