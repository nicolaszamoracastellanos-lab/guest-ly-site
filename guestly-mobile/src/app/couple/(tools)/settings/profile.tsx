import React from "react";
import { ProfileScreen } from "@/features/settings/screens/Profile";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's form.
export default function ProfileRoute() {
  return <ProfileScreen key={useTenantKey()} />;
}
