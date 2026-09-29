// "Take the tour" on the locked home (couple self-serve signup), and the one
// place that tells the welcome tour (src/features/tour) which accounts are
// "almost ready": a self-serve wedding awaiting activation.
//
// Registered at import. Route modules load eagerly at startup, and
// src/app/pending.tsx imports this file, so the check is in place before the
// tour's automatic trigger runs after a fresh sign-in.

import { setPendingAccountCheck, startTour } from "@/features/tour";
import type { Me } from "@/lib/session";

export function isPendingAccount(me: Me): boolean {
  return me.locked === true || me.tenant.billing_status === "pending_payment";
}

setPendingAccountCheck(isPendingAccount);

export function productPreviewAvailable(): boolean {
  return true;
}

/** Opens the "almost ready" couple tour over the locked home. */
export function openProductPreview(): void {
  startTour({ variant: "couple-pending" });
}
