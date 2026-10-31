import React from "react";
import { PreferencesScreen } from "@/features/settings/screens/Preferences";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's form.
export default function NotificationsRoute() {
  return <PreferencesScreen key={useTenantKey()} />;
}
