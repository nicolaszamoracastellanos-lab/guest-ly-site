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
import { useQuery } from "@tanstack/react-query";
import { useFeatureCopy } from "@/i18n/feature";
import { get } from "@/lib/api";
import { useGuestHome, type ThreadMessage } from "@/lib/hooks";
import { RoleTabs, type TabSpec } from "@/ui/TabBar";
import { GUEST_COPY } from "@/features/guest/copy";
import { useAskSeen } from "@/features/guest/state";

export default function GuestTabs() {
  const c = useFeatureCopy(GUEST_COPY).tabs;
  const { data: home } = useGuestHome();
  const { seen } = useAskSeen();
  // Same query as Ask (same key), without its polling. Only for a guest who
  // has opened Ask on this phone (the seen mark exists): reading the thread
  // creates the guest's app conversation on the server, which a guest who
  // never asked anything should not get just by opening the app.
  const { data: thread } = useQuery({
    queryKey: ["guest-messages"],
    queryFn: () => get<{ pending: boolean; conversation_id?: string; messages: ThreadMessage[] }>("/guest/messages"),
    enabled: typeof seen === "string",
    refetchInterval: 120_000,
  });
  const pending = home?.rsvp?.status === "pending" && !home.day_of && !home.countdown?.passed;
  const newestCouple = (thread?.messages ?? []).reduce<string | null>((acc, m) => (m.role === "couple" && (!acc || Date.parse(m.created_at) > Date.parse(acc)) ? m.created_at : acc), null);
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
