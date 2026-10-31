import React from "react";
import { TeamScreen } from "@/features/settings/team/TeamScreen";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's form.
export default function TeamRoute() {
  return <TeamScreen key={useTenantKey()} />;
}
