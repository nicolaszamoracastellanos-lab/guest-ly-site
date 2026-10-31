import React from "react";
import { BillingScreen } from "@/features/settings/screens/Billing";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: a switch never shows the previous wedding's form.
export default function BillingRoute() {
  return <BillingScreen key={useTenantKey()} surface="planner" />;
}
