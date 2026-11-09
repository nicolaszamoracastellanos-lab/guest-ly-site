// The snapshot the phone sends the Apple Watch (version 1). The watch decodes
// exactly this (targets/watch/Model.swift): all text is final display text in
// `lang`, numbers are plain numbers, an absent section is null. The watch does
// no formatting and no business logic.

export type WatchLang = "en" | "es";
export type WatchRole = "couple" | "planner" | "guest" | "none";

export type WatchSnapshot = {
  v: 1;
  at: number;
  lang: WatchLang;
  enabled: boolean;
  role: WatchRole;
  wedding: { names: string; dateText: string; days: number; passed: boolean; isDayOf: boolean } | null;
  replies: { going: number; pending: number; declined: number; total: number } | null;
  tasks: { done: number; total: number; items: { id: string; title: string; note: string; urgent: boolean; done: boolean }[] } | null;
  budget: { paidText: string; totalText: string; fraction: number; next: { name: string; amountText: string; dueText: string } | null } | null;
  team: { name: string; note: string; tel: string }[] | null;
  dayOf: {
    now: { title: string; line: string; leftText: string; fraction: number | null } | null;
    next: { time: string; title: string }[];
    overrun: { blockId: string; question: string; body: string; pushLabel: string; keepLabel: string } | null;
  } | null;
  door: { inCount: number; total: number; lastText: string | null } | null;
  vendorsToday: { summary: string; items: { blockId: string; name: string; note: string; state: "onsite" | "due" | "late"; tel?: string }[] } | null;
  weddings: { label: string; names: string; line: string; today: boolean }[] | null;
  needsYou: { id: string; from: string; question: string; canReply: boolean }[] | null;
  pass: { name: string; line: string; qr: string[] } | null;
  myDay: { time: string; title: string; note: string; soon: boolean }[] | null;
};

// ---- Builder inputs: the smallest structural slice of each API payload, so the
// builders stay pure (no hooks, no fetch) and the tests need no app runtime.

export type TaskIn = { id: string; title: string; status: string; due_date: string | null; days_left: number | null; completed_at: string | null };
export type VendorIn = { id: string; name: string; category: string; status: string; contact_name: string; phone: string };
export type VendorItemIn = { vendor_id: string | null; title: string; next_payment?: { on: string; amount: number; currency: string | null } | null };
export type BlockIn = { id: string; day: string; starts_at: string; ends_at: string | null; title: string; vendor_id: string | null; vendor_name: string | null; status: string };
export type DayOfBlockIn = { id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; state: "done" | "now" | "next" | "later" };
export type InboxIn = { id: string; channel: string; name: string; preview: string; needs_you: boolean };

export type CoupleIn = {
  nowMs: number;
  home?: {
    couple_names: string;
    wedding_date: string | null;
    countdown: { days: number; passed: boolean } | null;
    day_of: boolean;
    totals: { people_expected: number; attending_seats: number; declined_seats: number };
  };
  tasks?: { tasks: TaskIn[]; progress: { done: number; total: number } };
  budget?: { paid: number; total: number; fraction: number; currency: string } | null;
  vendors?: { vendors: VendorIn[]; items: VendorItemIn[] };
  dayof?: { day_of: boolean; seats_in: number; seats_total: number; runsheet: DayOfBlockIn[] };
  blocks?: BlockIn[];
  inbox?: InboxIn[];
  lastArrival?: { name: string; table: string | null } | null;
};

export type PlannerWeddingIn = {
  slug: string;
  couple_names: string;
  wedding_date: string | null;
  days_to_go: number | null;
  passed?: boolean;
  seats: { invited: number; attending: number; declined: number; pending: number } | null;
  open_requests: number | null;
};
export type PlannerIn = {
  nowMs: number;
  weddings?: PlannerWeddingIn[];
  tasks?: { id: string; title: string; status: string }[];
  agenda?: { time: string | null; title: string; location: string | null; kind: string }[];
  checkin?: { day_of: boolean; seats_in: number; seats_total: number } | null;
  lastArrival?: { name: string; table: string | null } | null;
};

export type GuestEventIn = { id: string; title: string; date: string | null; time: string | null; location: string | null; state?: "done" | "now" | "next" | "later" };
export type GuestIn = {
  nowMs: number;
  guestId: string;
  guestName: string;
  home?: { couple_names: string; wedding_date: string | null; countdown: { days: number; passed: boolean } | null; day_of: boolean; rsvp: { party_size: number | null; status: string } };
  events?: GuestEventIn[];
  table?: string | null;
};
