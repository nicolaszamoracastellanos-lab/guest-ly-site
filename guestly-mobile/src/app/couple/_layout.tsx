// Couple tabs (build 12): Inicio, Invitados, Mensajes, Plan, Más. RSVPs live
// inside Invitados (the old /couple/rsvps redirects there), announcements
// inside Mensajes, and the four planning tools under Plan. Every other
// section is a hidden route reached from Más, a header menu or a guest card.

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
    { name: "index", icon: "home", label: c.home, owns: ["dayof"] },
    { name: "guests", icon: "guests", label: c.guests, owns: ["rsvps"] },
    { name: "messages", icon: "chat", label: c.messages, badge, owns: ["broadcasts", "insights"] },
    { name: "plan", icon: "grid", label: c.plan, owns: ["budget", "tasks", "seating", "runsheet", "vendors", "requests"] },
    { name: "more", icon: "more", label: c.more },
  ];
  return (
    <RoleTabs
      specs={specs}
      // A wedding switch (Settings, or a notification for the other wedding)
      // sends the other tabs back to their lists: no record, thread or draft
      // of the previous wedding stays open (F1 for the couple).
      resetKey={tenantKey}
      hidden={[
        // RSVPs folded into Invitados: the route stays for pushes and the
        // portal's links and redirects to the guest list (questions and
        // record stay real screens).
        "rsvps",
        "dayof",
        "checkin",
        "requests",
        "tasks",
        "seating",
        "runsheet",
        "brain",
        "insights",
        "broadcasts",
        "budget",
        "vendors",
        "website",
        "settings",
      ]}
    />
  );
}
