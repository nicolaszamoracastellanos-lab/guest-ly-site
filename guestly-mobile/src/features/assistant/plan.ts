// #5 One sentence, several actions, one confirm (Master Wave, app 1.4.0): the
// pure half of the plan card. The server builds every line (sentence, area,
// status, error) from the stored plan in both languages (portal
// lib/coordinator-plan-core.ts buildPlanCard); this file only READS that card
// defensively and answers the questions the card asks: is it a plan, which
// lines may still be ticked, is it closed, may this line be undone now.
//
// The server sends a plan card only to builds at 1.4.0 and up with MW_PLAN_CARD
// on for the wedding (route appVersionAtLeast); without it the app draws the
// older single card. A plan the app cannot read falls back to that same card.
//
// PURE: no React, no imports. Tests: scripts/tests/plan-card.test.ts.

export type PlanArea = "tasks" | "vendors" | "budget" | "runsheet" | "guests" | "rsvps";
export type PlanStepStatus = "pending" | "running" | "done" | "failed" | "skipped" | "undone" | "unknown";
type Bi = { en: string; es: string };

export type PlanStep = {
  id: string;
  area: PlanArea;
  sentence: Bi;
  status: PlanStepStatus;
  error: Bi | null;
  /** Undo shows until this instant (a line the plan created, inside its window). */
  undoUntilMs: number | null;
};

export type Plan = {
  steps: PlanStep[];
  total: number;
  done: number;
  failed: number;
  ran: boolean;
  expired: boolean;
  replaced: boolean;
  retryable: number;
  retryKind: "failed" | "rest" | null;
  /** The couple's message that led to an expired plan ("Ask again" re-sends it). Additive, may be absent. */
  askAgain: string | null;
};

export const PLAN_TOOL = "propose_plan";
export const PLAN_AREAS: readonly PlanArea[] = ["tasks", "vendors", "budget", "runsheet", "guests", "rsvps"];
const STATUSES: readonly PlanStepStatus[] = ["pending", "running", "done", "failed", "skipped", "undone", "unknown"];
/** The server caps a plan at 8 lines and step ids at 8 characters (pickChatBody). */
export const PLAN_MAX_STEPS = 8;

function bi(v: unknown): Bi | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.en !== "string" || typeof o.es !== "string") return null;
  return { en: o.en, es: o.es };
}
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * The plan on a card, or null when the card is not a plan or the plan cannot
 * be read (the app then shows the card like any other, as 1.3 does). A line
 * without an id, a sentence or a known area makes the whole plan unreadable:
 * a checklist with a missing line would run something the person never saw.
 */
export function readPlan(card: { toolName?: unknown; plan?: unknown } | null | undefined): Plan | null {
  if (!card || card.toolName !== PLAN_TOOL || !card.plan || typeof card.plan !== "object") return null;
  const p = card.plan as Record<string, unknown>;
  if (!Array.isArray(p.steps) || p.steps.length === 0 || p.steps.length > PLAN_MAX_STEPS) return null;
  const steps: PlanStep[] = [];
  const seen = new Set<string>();
  for (const raw of p.steps) {
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Record<string, unknown>;
    const id = typeof s.id === "string" ? s.id : "";
    const sentence = bi(s.sentence);
    const area = PLAN_AREAS.includes(s.area as PlanArea) ? (s.area as PlanArea) : null;
    if (!id || id.length > 8 || seen.has(id) || !sentence || !area) return null;
    seen.add(id);
    const status = STATUSES.includes(s.status as PlanStepStatus) ? (s.status as PlanStepStatus) : "unknown";
    const until = typeof s.undoUntilMs === "number" && Number.isFinite(s.undoUntilMs) ? s.undoUntilMs : null;
    steps.push({ id, area, sentence, status, error: bi(s.error), undoUntilMs: until });
  }
  const retryKind = p.retryKind === "failed" || p.retryKind === "rest" ? p.retryKind : null;
  const ask = typeof p.askAgain === "string" && p.askAgain.trim() ? p.askAgain.trim().slice(0, 2000) : null;
  return {
    steps,
    total: num(p.total) || steps.length,
    done: num(p.done),
    failed: num(p.failed),
    ran: p.ran === true,
    expired: p.expired === true,
    replaced: p.replaced === true,
    retryable: retryKind ? Math.max(0, Math.floor(num(p.retryable))) : 0,
    retryKind,
    askAgain: ask,
  };
}

/** What the card shows, from its status, its plan and the clock. */
export type PlanPhase =
  /** Never ran, window open: ticks, Run and Discard. */
  | "proposed"
  /** Ran at least once: one result per line, Undo, maybe a retry. */
  | "ran"
  /** Never ran, its window closed (stored, or past expiresAtMs on screen). */
  | "expired"
  /** Never ran, a newer proposal closed it inside its window. */
  | "replaced"
  /** Never ran, the person discarded it. */
  | "discarded";

export function planPhase(card: { status: string; expiresAtMs: number }, plan: Plan, now: number): PlanPhase {
  if (plan.ran) return "ran";
  const waiting = card.status === "proposed";
  if (plan.expired || (waiting && card.expiresAtMs > 0 && now > card.expiresAtMs)) return "expired";
  if (plan.replaced) return "replaced";
  if (waiting) return "proposed";
  return "discarded";
}

/** The ids sent on Run, in the plan's order (never the order they were ticked). */
export function keepIds(plan: Plan, ticked: ReadonlySet<string>): string[] {
  return plan.steps.filter((s) => ticked.has(s.id)).map((s) => s.id);
}

/** Undo shows on a line the plan created, while its window is open, for a person who may edit. */
export function undoOpen(step: PlanStep, now: number, canEdit: boolean): boolean {
  return canEdit && step.status === "done" && step.undoUntilMs !== null && now < step.undoUntilMs;
}

/** The soonest instant a line's Undo closes after `now` (the card redraws then), or null. */
export function nextUndoClose(plan: Plan, now: number): number | null {
  let soonest: number | null = null;
  for (const s of plan.steps) if (s.status === "done" && s.undoUntilMs !== null && s.undoUntilMs > now && (soonest === null || s.undoUntilMs < soonest)) soonest = s.undoUntilMs;
  return soonest;
}

/** A finished Undo: the line now reads "undone" on the server's card. */
export function lineUndone(card: { plan?: unknown; toolName?: unknown } | null | undefined, stepId: string): boolean {
  return readPlan(card)?.steps.some((s) => s.id === stepId && s.status === "undone") ?? false;
}

/** A struck line: skipped or undone. */
export function struck(status: PlanStepStatus): boolean {
  return status === "skipped" || status === "undone";
}
