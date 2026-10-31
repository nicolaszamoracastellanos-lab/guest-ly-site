// The customizable Home on the wire (Oct 31 2026). GET /couple/home gains
// `layout` (the wedding's saved Home, effective for today's phase) and `cards`
// (the data of each visible card the older payload does not carry). Both are
// additive: a portal without them leaves Home exactly as it was.
//
// The cards.* shapes are the app's reading of the portal's
// src/lib/home-cards.ts; every field is optional and every card renders a
// tidy line with a link when its data is missing or null.

// Pure and type-only imports (no React, no network): scripts/tests/home-cards.test.ts
// runs it. readLayout and the save hooks live in homeCards.ts.
import type { CoupleHome } from "@/lib/hooks";
import type { CardId, HomeAnswers, HomeCard, Phase } from "./homeLayout";

export type RecapPref = { cadence: "daily" | "weekly" | "needed"; weekday: number; hour: number };

export type HomeLayoutPayload = {
  configured: boolean;
  answers: HomeAnswers;
  /** Effective for today's phase, in display order. */
  cards: HomeCard[];
  phase: Phase;
  dismissed: string[];
  canEdit: boolean;
  /** The caller's own recap choice (per person), when the portal sends it. */
  recap?: RecapPref | null;
};

type Dated = { at?: string | null };
export type HomeCardsData = {
  questions?: { waiting?: number; answered_7d?: number | null; items?: { id?: string; text: string; guest?: string | null }[] } | null;
  tasks?: { open?: number; overdue?: number; items?: ({ id: string; title: string; due?: string | null; assignee?: string | null } & Dated)[] } | null;
  budget?: { planned?: number | null; spent?: number | null; currency?: string | null; next?: { label: string; amount?: number | null; due?: string | null } | null } | null;
  vendors?: { booked?: number; total?: number; next?: { title: string; at?: string | null; vendor?: string | null }[] } | null;
  seating?: { seated?: number; attending?: number; tables?: number } | null;
  website?: { published?: boolean; visits_7d?: number | null; next_step?: string | null } | null;
  runsheet?: { items?: { time?: string | null; title: string; place?: string | null }[] } | null;
  checkin?: { arrived?: number; expected?: number } | null;
  album?: { enabled?: boolean; photos?: number; contributors?: number; pending?: number } | null;
  thankyou?: { written?: number; total?: number } | null;
  partner?: { people?: { name: string; open_tasks: number }[] } | null;
  planner?: { name?: string | null; agency?: string | null; open_requests?: number } | null;
};

export type CoupleHomeWithLayout = CoupleHome & { layout?: unknown; cards?: HomeCardsData | null };

/** Where each card opens. */
export const CARD_ROUTES: Record<CardId, string> = {
  countdown: "/couple/settings/general",
  briefing: "/couple/requests",
  setup: "/couple/tools",
  rsvp: "/couple/guests",
  replies: "/couple/rsvps",
  questions: "/couple/messages",
  tasks: "/couple/tasks",
  budget: "/couple/budget",
  vendors: "/couple/vendors",
  seating: "/couple/seating",
  website: "/couple/website",
  runsheet: "/couple/runsheet",
  checkin: "/couple/checkin",
  album: "/couple/album",
  thankyou: "/couple/thankyou",
  partner: "/couple/tasks",
  planner: "/couple/requests",
  activity: "/couple/insights",
};

/** Groups the visible cards into rows of two columns from rowSpans (each row sums to 2). */
export function rowsOf<C>(items: C[], spans: number[]): { item: C; span: number }[][] {
  const rows: { item: C; span: number }[][] = [];
  let cur: { item: C; span: number }[] = [];
  let sum = 0;
  items.forEach((item, i) => {
    const span = spans[i] ?? 2;
    cur.push({ item, span });
    sum += span;
    if (sum >= 2) {
      rows.push(cur);
      cur = [];
      sum = 0;
    }
  });
  if (cur.length) rows.push(cur);
  return rows;
}
