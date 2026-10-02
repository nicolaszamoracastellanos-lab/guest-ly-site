// How a sent announcement reads in a list: its title and delivery line.
// Shared by Messages (Announcements), the Broadcasts screen and the planner.

import { fmt } from "@/i18n";
import type { HistoryGroup } from "./hooks";
import type { COPY } from "./copy";

export function groupTitle(g: HistoryGroup, unknown: string): string {
  if (g.groupKind === "campaign") return g.label;
  return g.label ?? unknown;
}

export function deliveryLine(g: HistoryGroup, c: (typeof COPY)["en"]): string {
  if (g.groupKind === "campaign") {
    const parts = [fmt(c.sentOf, { sent: g.sent, total: g.audience })];
    if (g.failed) parts.push(fmt(c.failed, { n: g.failed }));
    if (g.delivery) parts.push(fmt(c.delivered, { n: g.delivery.delivered }));
    return parts.join(" · ");
  }
  const parts = [fmt(c.messages, { n: g.count })];
  if (g.delivery) parts.push(fmt(c.delivered, { n: g.delivery.delivered }));
  return parts.join(" · ");
}
