// RSVP rules shared by the wizard and the confirmation card. Same rules as the
// web wizard and the portal's submit route (lib/rsvp relevantQuestions):
// a general question (event_id null) is always asked; an event question only
// while someone in the party attends that event. Pure, so node can test it.

type Bi = { en?: string | null; es?: string | null } | null | undefined;
export type Question = {
  id: string;
  label: Bi;
  kind?: "select" | "text";
  type?: string;
  required?: boolean;
  options?: { id: string; label: Bi }[];
  event_id: string | null;
};
type Seat = Record<string, "attending" | "declined">;

/** The server caps a roster at 20 people (MAX_COMPANIONS). */
export const MAX_ROSTER = 20;

export function bi(v: Bi, lang: "en" | "es"): string {
  return (v?.[lang] || v?.en || v?.es || "").trim();
}

export function isSelect(q: Question): boolean {
  if (q.kind) return q.kind === "select";
  return (q.options?.length ?? 0) > 0 && q.type !== "text";
}

/** Questions to ask now, in the couple's order: general ones first as the
 *  server sends them, then those for events someone attends. */
export function relevantQuestions<Q extends Question>(questions: Q[], seats: Seat[]): Q[] {
  return questions.filter((q) => q.event_id === null || seats.some((s) => s[q.event_id as string] === "attending"));
}

/** Required questions without an answer. */
export function missingRequired<Q extends Question>(relevant: Q[], answers: Record<string, string>): Q[] {
  return relevant.filter((q) => q.required && !(answers[q.id] ?? "").trim());
}

/** Only answers to relevant questions, trimmed, empty ones dropped. */
export function answersToSend(relevant: Question[], answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of relevant) {
    const v = (answers[q.id] ?? "").trim();
    if (v) out[q.id] = v;
  }
  return out;
}

/** One printable row per answered question: its label and the chosen option's
 *  label (never an internal option id). */
export function answerRows(questions: Question[], answers: Record<string, string> | null | undefined, lang: "en" | "es"): { id: string; label: string; value: string }[] {
  if (!answers) return [];
  const rows: { id: string; label: string; value: string }[] = [];
  for (const q of questions) {
    const v = (answers[q.id] ?? "").trim();
    if (!v) continue;
    const label = bi(q.label, lang);
    if (!label) continue;
    const value = isSelect(q) ? bi(q.options?.find((o) => o.id === v)?.label, lang) : v;
    if (value) rows.push({ id: q.id, label, value });
  }
  return rows;
}
