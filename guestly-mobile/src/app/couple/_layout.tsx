// Couple tabs (build 15): Inicio, Invitados, Mensajes, Coordinador,
// Herramientas. RSVPs live inside Invitados (the old /couple/rsvps redirects
// there), broadcasts live inside Mensajes (a switch at its top; the screens
// stay under /couple/broadcasts), the Coordinator is a tab (a showcase when it
// is off for the wedding) and Herramientas holds the planning tools and
// everything the old Más listed. Settings is the gear on Inicio (and the last
// row of Herramientas). Plan and Más stay as routes that redirect to
// Herramientas, for old pushes and links.

import React, { useEffect } from "react";
import { useInbox } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { enterTenantScope } from "@/features/shared/tenantScope";
import { useCoupleCopy } from "@/features/couple/ui";
import { RoleNativeTabs, useTenantStackReset, type RoleTab } from "@/ui/NativeRoleTabs";
import { CoupleWidgetSync } from "@/features/widgets/WidgetSync";
import { CoupleDayPackSync } from "@/features/dayof/PackSync";

const COUPLE_STACKS: ReadonlySet<string> = new Set(["(guests)", "(messages)", "(tools)"]);

export default function CoupleTabs() {
  const c = useCoupleCopy().tabs;
  const { state } = useSession();
  const scopeKey = state.status === "user" ? `${state.me.user.id}:${state.me.tenant.slug}` : null;
  // The brain and seating drafts are module stores: a different account or
  // wedding than last time starts them empty.
  useEffect(() => {
    if (scopeKey) enterTenantScope(scopeKey);
  }, [scopeKey]);
  const { data } = useInbox("needs_you");
  const badge = data?.needs_you ?? 0;
  // Sections live inside the tab that opens them (route groups, URLs unchanged):
  // Expo Router 58 redirects away from hidden tab routes.
  const tabs: RoleTab[] = [
    { name: "index", sf: { default: "house", selected: "house.fill" }, label: c.home },
    { name: "(guests)", sf: { default: "person.2", selected: "person.2.fill" }, label: c.guests, owns: ["rsvps"] },
    { name: "(messages)", sf: { default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }, label: c.messages, badge, owns: ["broadcasts"] },
    { name: "coordinator", sf: { default: "sparkles", selected: "sparkles" }, label: c.coordinator },
    { name: "(tools)", sf: { default: "square.grid.2x2", selected: "square.grid.2x2.fill" }, label: c.tools, owns: ["website", "budget", "tasks", "seating", "runsheet", "vendors", "requests", "brain", "insights", "checkin", "dayof", "plan", "more", "settings"] },
  ];
  // A wedding switch (Settings, or a notification for the other wedding) sends
  // every tab back to its list: no record, thread or draft of the previous
  // wedding stays open (F1 for the couple).
  const tenantReset = useTenantStackReset(COUPLE_STACKS, false);
  return (
    <>
      <RoleNativeTabs surface="couple" tabs={tabs} fallback="(tools)" screenListeners={tenantReset} />
      <CoupleWidgetSync />
      <CoupleDayPackSync />
    </>
  );
}
