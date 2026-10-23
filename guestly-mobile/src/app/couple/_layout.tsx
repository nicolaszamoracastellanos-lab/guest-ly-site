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
import { RoleTabs, type TabSpec } from "@/ui/TabBar";

export default function CoupleTabs() {
  const c = useCoupleCopy().tabs;
  const { state, tenantKey } = useSession();
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
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.home },
    { name: "(guests)", icon: "guests", label: c.guests },
    { name: "(messages)", icon: "chat", label: c.messages, badge },
    { name: "coordinator", icon: "sparkle", label: c.coordinator },
    { name: "(tools)", icon: "grid", label: c.tools },
  ];
  return (
    <RoleTabs
      specs={specs}
      fallback="(tools)"
      // A wedding switch (Settings, or a notification for the other wedding)
      // sends the other tabs back to their lists: no record, thread or draft
      // of the previous wedding stays open (F1 for the couple).
      resetKey={tenantKey}
    />
  );
}
