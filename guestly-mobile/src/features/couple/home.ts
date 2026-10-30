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
