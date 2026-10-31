import React from "react";
import { VendorsListScreen } from "@/features/vendors/screens/List";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: search text and filters never carry over (F1).
export default function VendorsRoute() {
  return <VendorsListScreen key={useTenantKey()} />;
}
