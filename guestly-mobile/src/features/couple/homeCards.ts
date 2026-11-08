// The customizable Home: saving the layout and the caller's recap. The wire
// types and pure helpers are in homeCardsCore.ts.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, del } from "@/lib/api";
import { sanitizeLayout, type HomeAnswers, type HomeCard } from "./homeLayout";
import { keepServed } from "./road";
import type { CoupleHomeWithLayout, HomeCardsData, HomeLayoutPayload, RecapPref } from "./homeCardsCore";

export * from "./homeCardsCore";

/** The layout block of a home payload, validated; null when the portal sent none (older portal) or it does not parse. */
export function readLayout(raw: unknown): HomeLayoutPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const clean = sanitizeLayout(r);
  if (!clean) return null;
  const phase = r.phase === "final" || r.phase === "week" || r.phase === "after" ? r.phase : "planning";
  const rc = r.recap as Record<string, unknown> | null | undefined;
  const recap: (RecapPref & { set: boolean }) | null =
    rc && typeof rc === "object" && (rc.cadence === "daily" || rc.cadence === "weekly" || rc.cadence === "needed")
      ? { cadence: rc.cadence, weekday: clampInt(rc.weekday, 0, 6, 1), hour: clampInt(rc.hour, 0, 23, 8), set: rc.set !== false }
      : null;
  const quizState = r.quizState === "done" || r.quizState === "skipped" ? r.quizState : null;
  // K8: a card the core introduces but the server did not list (flag off, an
  // older portal) is neither drawn nor posted back.
  const cards = keepServed(clean.cards, r.cards);
  return { configured: r.configured === true, quizState, answers: clean.answers, cards, phase, dismissed: clean.dismissed, canEdit: r.canEdit === true, recap, served: cards.map((c) => c.id) };
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;
}


export type LayoutPut = {
  answers?: HomeAnswers;
  cards?: HomeCard[];
  dismissed?: string[];
  quiz_state?: "done" | "skipped";
  recap?: RecapPref;
};

/** Saves the layout (editors) and/or the caller's recap; the home payload refetches. */
export function useSaveHomeLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LayoutPut) => api<{ layout?: unknown; cards?: HomeCardsData | null }>("/couple/home-layout", { method: "PUT", body }),
    onSuccess: (data) => applySaved(qc, data),
  });
}

/** PUT and DELETE answer the same { layout, cards } as GET /couple/home adds: Home redraws at once, then refetches. */
function applySaved(qc: ReturnType<typeof useQueryClient>, data: { layout?: unknown; cards?: HomeCardsData | null } | null | undefined) {
  if (data && readLayout(data.layout)) qc.setQueryData<CoupleHomeWithLayout>(["couple-home"], (prev) => (prev ? { ...prev, layout: data.layout, cards: data.cards ?? prev.cards } : prev));
  void qc.invalidateQueries({ queryKey: ["couple-home"] });
}

/** Back to suggested: the cards the answers suggest, nothing dismissed. */
export function useResetHomeLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del<{ layout?: unknown; cards?: HomeCardsData | null }>("/couple/home-layout"),
    onSuccess: (data) => applySaved(qc, data),
  });
}

