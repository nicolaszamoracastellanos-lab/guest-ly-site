// Couple tabs (build 13): Inicio, Invitados, Mensajes, Avisos, Herramientas.
// RSVPs live inside Invitados (the old /couple/rsvps redirects there),
// broadcasts are their own tab, and Herramientas holds the planning tools and
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
  const specs: TabSpec[] = [
    { name: "index", icon: "home", label: c.home },
    { name: "guests", icon: "guests", label: c.guests, owns: ["rsvps"] },
    { name: "messages", icon: "chat", label: c.messages, badge },
    { name: "broadcasts", icon: "megaphone", label: c.broadcasts },
    // Anything else (settings) lights Tools too: it is the fallback tab.
    { name: "tools", icon: "grid", label: c.tools, owns: ["website", "budget", "tasks", "seating", "runsheet", "vendors", "requests", "brain", "insights", "checkin", "dayof", "plan", "more"] },
  ];
  return (
    <RoleTabs
      specs={specs}
      fallback="tools"
      // A wedding switch (Settings, or a notification for the other wedding)
      // sends the other tabs back to their lists: no record, thread or draft
      // of the previous wedding stays open (F1 for the couple).
      resetKey={tenantKey}
      hidden={[
        // RSVPs folded into Invitados: the route stays for pushes and the
        // portal's links and redirects to the guest list (questions and
        // record stay real screens).
        "rsvps",
        // Build 12 tabs that now open Tools.
        "plan",
        "more",
        "dayof",
        "checkin",
        "requests",
        "tasks",
        "seating",
        "runsheet",
        "brain",
        "insights",
        "budget",
        "vendors",
        "website",
        "settings",
      ]}
    />
  );
}
