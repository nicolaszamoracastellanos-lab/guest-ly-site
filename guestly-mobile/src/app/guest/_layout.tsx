// Guest tabs (build 12, plan b, decision D5): Invitation, Schedule, Ask, Info.
//
// Route names stay the build 11 ones so every push, portal and /i/ link keeps
// working (lib/push SECTIONS.guest): "index" is Invitation, "concierge" is Ask,
// "more" is Info. Moved screens:
//   /guest/rsvp      the one-screen RSVP, opened from the Home card (owned by
//                    Invitation, so that tab stays lit and back returns there)
//   /guest/dayof     the day view (Home is the day view on the day)
//   /guest/messages  redirects to Ask, where couple replies now land
//   /guest/site/*    the couple's site pages, under Info
// Gold dot on Invitation while the reply is pending; on Ask while a couple
// reply is unread.

import React from "react";
import { useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useGuestHome, useGuestMessagesPeek } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { useGuestPermissionCheck } from "@/features/guest/permission";
import { RoleTabs, type TabSpec } from "@/ui/TabBar";
import { GUEST_COPY } from "@/features/guest/copy";
import { useAskSeen } from "@/features/guest/state";

export default function GuestTabs() {
  const c = useFeatureCopy(GUEST_COPY).tabs;
  const { data: home } = useGuestHome();
  const { seen } = useAskSeen();
  // Oct 7 2026: the couple's broadcasts land in Ask too, so the dot must
  // show for every signed-in guest, not only one who opened Ask before.
  // The peek read has no side effects on the server (no conversation is
  // created, nothing is marked read).
  const session = useGuestSession();
  const { data: thread } = useGuestMessagesPeek(!!session);
  // Reports the notification permission and explains it once when denied.
  useGuestPermissionCheck(useCopy());
  const pending = home?.rsvp?.status === "pending" && !home.day_of && !home.countdown?.passed;
  // The portal answers latest_couple_at directly (?latest=1); an older
  // portal sends the thread instead and the newest couple line is found here.
  const newestCouple =
    thread?.latest_couple_at !== undefined
      ? thread.latest_couple_at
      : (thread?.messages ?? []).reduce<string | null>((acc, m) => (m.role === "couple" && (!acc || Date.parse(m.created_at) > Date.parse(acc)) ? m.created_at : acc), null);
  // Unread only once the seen mark has loaded (undefined = still reading it).
  const unread = !!newestCouple && seen !== undefined && (!seen || Date.parse(newestCouple) > Date.parse(seen));

  const specs: TabSpec[] = [
    { name: "index", icon: "mail", label: c.invitation, owns: ["rsvp", "dayof"], badge: pending ? "dot" : null },
    { name: "schedule", icon: "calendar", label: c.schedule },
    { name: "concierge", icon: "chat", label: c.ask, owns: ["messages"], badge: unread ? "dot" : null },
    { name: "more", icon: "info", label: c.info, owns: ["site"] },
  ];
  return <RoleTabs specs={specs} hidden={["rsvp", "dayof", "messages", "site"]} />;
}
