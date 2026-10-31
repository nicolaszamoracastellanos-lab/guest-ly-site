// Pure helpers of the wedding-first couple Home (HH craft pass, Oct 30 2026).
// No React, no imports with side effects: scripts/tests/home.test.ts runs them
// under plain node.

/** The fields of an RSVP list row Home reads. */
export type ReplyRow = { id: string; status: "attending" | "declined" | "pending"; updated_at: string | null };

/** The newest answered replies (not pending, with a time), newest first. */
export function recentReplies<R extends ReplyRow>(items: readonly R[] | undefined, n = 5): R[] {
  return (items ?? [])
    .filter((r) => r.status !== "pending" && !!r.updated_at && !Number.isNaN(Date.parse(r.updated_at)))
    .sort((a, b) => Date.parse(b.updated_at ?? "") - Date.parse(a.updated_at ?? ""))
    .slice(0, n);
}

/** The reply funnel in PEOPLE, the portal's one attendance definition since
 *  wave 13: invited = going + not going + pending. */
export type Funnel = { invited: number; replied: number; going: number; notGoing: number; pending: number };

export function funnelFrom(t: { people_expected?: number; attending_seats?: number; declined_seats?: number } | null | undefined): Funnel {
  const invited = Math.max(0, t?.people_expected ?? 0);
  const going = Math.max(0, t?.attending_seats ?? 0);
  const notGoing = Math.max(0, t?.declined_seats ?? 0);
  return { invited, replied: going + notGoing, going, notGoing, pending: Math.max(0, invited - going - notGoing) };
}

/** Share of `of`, 0 to 1; 0 when there is nothing to divide by. */
export function share(n: number, of: number): number {
  return of > 0 ? Math.max(0, Math.min(1, n / of)) : 0;
}

/** The briefing rows Today shows under its own request and message rows.
 *  The couple briefing already carries a `requests_open` row (open planner
 *  requests) and `escalation_open` rows (escalated guest questions); when the
 *  breakdown row for the same thing is on screen, the briefing copy would say
 *  it twice, so it is dropped. Rows without a kind (a portal before v1.2) are
 *  kept: nothing proves they repeat a breakdown row. */
export function todayBriefing<B extends { kind?: unknown }>(briefing: readonly B[] | null | undefined, breakdown: { requests?: number; conversations?: number } | null | undefined): B[] {
  const hasRequests = (breakdown?.requests ?? 0) > 0;
  const hasMessages = (breakdown?.conversations ?? 0) > 0;
  return (briefing ?? []).filter((b) => !((hasRequests && b.kind === "requests_open") || (hasMessages && b.kind === "escalation_open")));
}

// ---------------------------------------------------------------- HH wave F
// /couple/home now carries the setup steps (lib/setup on the portal), the
// activity feed and the deadline. The app maps each step to its own screen
// (the server's `path` is the web page) and each activity kind to an icon.

/** The app screen that finishes a setup step; null when no app screen can. */
export const SETUP_ROUTES: Record<string, string> = {
  date_city: "/couple/settings/general",
  guests_10: "/couple/guests",
  brain_core: "/couple/brain",
  website_published: "/couple/website",
  rsvp_opened: "/couple/guests",
  whatsapp_live: "/couple/settings/connections",
  reminders_on: "/couple/settings/reminders",
  first_broadcast: "/couple/broadcasts/new",
  passes_sent: "/couple/broadcasts",
};

export function setupRoute(key: string): string | null {
  return Object.prototype.hasOwnProperty.call(SETUP_ROUTES, key) ? SETUP_ROUTES[key] : null;
}

/** Icon names from ui/Icon for each activity kind (an unknown kind: info). */
export function activityIcon(kind: string): "eye" | "edit" | "check" | "undo" | "qr" | "bell" | "chat" | "mail" | "info" {
  switch (kind) {
    case "link_opened":
    case "pass_opened":
      return "eye";
    case "wizard_started":
      return "edit";
    case "rsvp_submitted":
      return "check";
    case "rsvp_changed":
      return "undo";
    case "checked_in":
      return "qr";
    case "reminder_sent":
      return "bell";
    case "message_sent":
      return "chat";
    case "email_sent":
      return "mail";
    default:
      return "info";
  }
}

/** True for a plain YYYY-MM-DD deadline; free text ("end of March") is shown as written. */
export function isIsoDay(s: string | null | undefined): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}/.test(s);
}
