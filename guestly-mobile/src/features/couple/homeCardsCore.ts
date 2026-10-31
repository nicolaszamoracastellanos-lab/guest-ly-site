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
  quizState?: "done" | "skipped" | null;
  /** The caller's own recap choice (per person); `set` false = never chosen (the default). */
  recap?: (RecapPref & { set?: boolean }) | null;
};

// Mirrors the portal's src/lib/home-cards.ts (feat/custom-home b0319941).
// Cards Home already had (briefing, rsvp, replies, setup, activity) and the
// countdown, budget, questions and tasks cards read the older home fields.
export type VendorsCard = { booked: number; total: number; toBook: { id: string; name: string; category: string; status: "shortlist" | "contacted" | "quoted" }[] };
export type SeatingCard = { seated: number; confirmed: number; tables: number };
export type WebsiteCard = { published: boolean; path: string; updatedAt: string | null };
export type RunsheetCard = { day: string; blocks: { id: string; startsAt: string | null; title: string; location: string | null }[]; total: number };
export type CheckinCard = { arrived: number; expected: number };
export type AlbumCard = { enabled: boolean; approved: number; pending: number; guests: number };
export type ThankYouCard = { done: number; total: number };
export type PartnerCard = { people: { userId: string; name: string; isMe: boolean; openTasks: number }[] };
export type PlannerCard = { open: number; plannerName: string | null };
export type HomeCardsData = {
  vendors?: VendorsCard | null;
  seating?: SeatingCard | null;
  website?: WebsiteCard | null;
  runsheet?: RunsheetCard | null;
  checkin?: CheckinCard | null;
  album?: AlbumCard | null;
  thankyou?: ThankYouCard | null;
  partner?: PartnerCard | null;
  planner?: PlannerCard | null;
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
