import React from "react";
import { BudgetOverviewScreen } from "@/features/budget/screens/Overview";
import { useTenantKey } from "@/lib/session";

// Keyed by the wedding: the root of this hidden stack stays mounted across a
// wedding switch, and its selected budget must not carry over (F1).
export default function BudgetRoute() {
  return <BudgetOverviewScreen key={useTenantKey()} />;
}
