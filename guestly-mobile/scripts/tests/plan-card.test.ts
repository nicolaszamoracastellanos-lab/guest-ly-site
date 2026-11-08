// Run: node --experimental-strip-types scripts/tests/plan-card.test.ts
// #5 plan card, the app's side (src/features/assistant/plan.ts): reading the
// server's card (fixtures recorded from the portal's buildPlanCard), phases,
// the ticked lines sent on Run, the Undo window, copy parity and static checks
// that the chat wires the plan_step event, keepStepIds and the consent gate.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const P = await import("../../src/features/assistant/plan.ts");
const { PLAN_COPY, PLAN_AREA_ROUTE } = await import("../../src/features/assistant/planCopy.ts");
const FX = JSON.parse(src("scripts/tests/fixtures/coordinator/plan-cards.json")) as { now: number; cards: Record<string, Record<string, unknown> & { status: string; expiresAtMs: number }> };
const NOW = FX.now;

let n = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

t("reads every recorded card", () => {
  for (const [k, card] of Object.entries(FX.cards)) {
    const plan = P.readPlan(card);
    assert.ok(plan, k);
    assert.equal(plan!.steps.length, 4, k);
    for (const s of plan!.steps) {
      assert.ok(s.sentence.en && s.sentence.es, `${k} ${s.id} sentence`);
      assert.ok(P.PLAN_AREAS.includes(s.area));
    }
  }
});

t("phases: proposed, ran, expired, replaced, discarded", () => {
  const ph = (k: string, now = NOW) => P.planPhase(FX.cards[k], P.readPlan(FX.cards[k])!, now);
  assert.equal(ph("proposed"), "proposed");
  assert.equal(ph("ran_partial"), "ran");
  assert.equal(ph("expired"), "expired");
  assert.equal(ph("replaced"), "replaced");
  // The window closes while the card is on screen: expired, never Run.
  assert.equal(ph("proposed", FX.cards.proposed.expiresAtMs + 1), "expired");
  const discarded = { ...FX.cards.proposed, status: "cancelled" };
  assert.equal(P.planPhase(discarded, P.readPlan(discarded)!, NOW), "discarded");
});

t("not a plan: other tools, missing or broken plans read null (the single card is drawn)", () => {
  assert.equal(P.readPlan({ toolName: "add_guest", plan: FX.cards.proposed.plan }), null);
  assert.equal(P.readPlan({ toolName: "propose_plan" }), null);
  assert.equal(P.readPlan(null), null);
  const bad = (mut: (s: Record<string, unknown>[]) => void) => {
    const plan = JSON.parse(JSON.stringify(FX.cards.proposed.plan));
    mut(plan.steps);
    return P.readPlan({ toolName: "propose_plan", plan });
  };
  assert.equal(bad((s) => delete s[1].sentence), null, "a line without its sentence never runs unseen");
  assert.equal(bad((s) => (s[0].area = "budgetz")), null);
  assert.equal(bad((s) => (s[2].id = s[1].id)), null, "duplicate ids");
  assert.equal(bad((s) => (s[0].id = "toolongid")), null);
  assert.equal(bad((s) => s.push(...s.map((x, i) => ({ ...x, id: `x${i}` })), { ...s[0], id: "y" })), null, "more than 8 lines");
  // An unknown status reads "To check", never "Done".
  const odd = bad((s) => (s[0].status = "weird"));
  assert.equal(odd!.steps[0].status, "unknown");
});

t("Run sends the ticked lines in the plan's order", () => {
  const plan = P.readPlan(FX.cards.proposed)!;
  assert.deepEqual(P.keepIds(plan, new Set(["s4", "s1", "s3"])), ["s1", "s3", "s4"]);
  assert.deepEqual(P.keepIds(plan, new Set()), []);
  assert.deepEqual(P.keepIds(plan, new Set(["nope"])), []);
});

t("Undo only on done lines the plan created, inside the window, for an editor", () => {
  const plan = P.readPlan(FX.cards.ran_partial)!;
  const s1 = plan.steps.find((s) => s.id === "s1")!;
  const s2 = plan.steps.find((s) => s.id === "s2")!;
  assert.equal(P.undoOpen(s1, NOW, true), true);
  assert.equal(P.undoOpen(s1, NOW, false), false, "read-only role");
  assert.equal(P.undoOpen(s1, s1.undoUntilMs!, true), false, "window closed");
  assert.equal(P.undoOpen(s2, NOW, true), false, "failed line");
  assert.equal(P.nextUndoClose(plan, NOW), s1.undoUntilMs);
  assert.equal(P.nextUndoClose(plan, s1.undoUntilMs! + 1), plan.steps.find((s) => s.id === "s4")!.undoUntilMs);
  assert.equal(P.nextUndoClose(plan, Number.MAX_SAFE_INTEGER), null);
});

t("a failed line keeps the server's reason in both languages", () => {
  const s2 = P.readPlan(FX.cards.ran_partial)!.steps.find((s) => s.id === "s2")!;
  assert.equal(s2.status, "failed");
  assert.ok(s2.error && s2.error.en && s2.error.es);
  assert.equal(P.struck("skipped"), true);
  assert.equal(P.struck("undone"), true);
  assert.equal(P.struck("done"), false);
});

t("lineUndone reads the server's answer to an Undo", () => {
  const card = JSON.parse(JSON.stringify(FX.cards.ran_partial));
  assert.equal(P.lineUndone(card, "s1"), false);
  card.plan.steps[0].status = "undone";
  assert.equal(P.lineUndone(card, "s1"), true);
});

t("askAgain is additive: read when sent, trimmed and capped", () => {
  assert.equal(P.readPlan(FX.cards.expired)!.askAgain, null);
  const card = JSON.parse(JSON.stringify(FX.cards.expired));
  card.plan.askAgain = "  Agrega a Ana y recuérdales a los pendientes  ";
  assert.equal(P.readPlan(card)!.askAgain, "Agrega a Ana y recuérdales a los pendientes");
});

t("copy: same keys EN/ES, the portal's words, no dashes, no '!', placeholders kept", () => {
  const flat = (o: unknown, pre = ""): Record<string, string> =>
    Object.entries(o as Record<string, unknown>).reduce((acc, [k, v]) => (typeof v === "string" ? { ...acc, [pre + k]: v } : { ...acc, ...flat(v, `${pre}${k}.`) }), {} as Record<string, string>);
  const en = flat(PLAN_COPY.en);
  const es = flat(PLAN_COPY.es);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  for (const [k, v] of Object.entries({ ...en, ...Object.fromEntries(Object.entries(es).map(([a, b]) => [`es.${a}`, b])) })) {
    assert.ok(!/[–—!]/.test(v), `${k}: ${v}`);
    assert.ok(!/successfully|exitosamente|con éxito|oops/i.test(v), k);
  }
  for (const k of Object.keys(en)) assert.deepEqual((en[k].match(/\{\w+\}/g) ?? []).sort(), (es[k].match(/\{\w+\}/g) ?? []).sort(), k);
  // The portal's sentences, word for word (src/lib/i18n/coordinator-plan.ts).
  assert.equal(PLAN_COPY.en.helper, "Untick what you do not want. Nothing changes until you run it.");
  assert.equal(PLAN_COPY.es.helper, "Desmarca lo que no quieras. Nada cambia hasta que lo ejecutes.");
  assert.equal(PLAN_COPY.es.discard, "Descartar plan");
  assert.equal(PLAN_COPY.en.replaced, "A newer proposal replaced this plan. Nothing changed.");
  for (const a of P.PLAN_AREAS) assert.ok(PLAN_AREA_ROUTE[a].startsWith("/couple/"));
});

t("static: the chat draws plans from the card, handles plan_step, sends keepStepIds only on Run", () => {
  const view = src("src/features/assistant/AssistantView.tsx");
  assert.ok(view.includes('case "plan_step":'));
  assert.ok(/const plan = readPlan\(card\)/.test(view), "plans come from readPlan, never model text");
  assert.ok(/confirmActionId: card\.id, \.\.\.\(keepStepIds \? \{ keepStepIds \} : \{\}\)/.test(view), "retry sends no keep list");
  assert.ok(/undoActionId: card\.id, undoStepId: step\.id/.test(view));
  assert.ok(view.includes("replaced: true"), "a new message marks an open plan replaced, never discarded");
  for (const fn of ["send", "confirm", "runPlan"]) {
    const body = view.slice(view.indexOf(`async function ${fn}(`), view.indexOf(`async function ${fn}(`) + 900);
    assert.ok(body.includes('consent.ask("coordinator")'), `${fn} asks 5.1.2(i) consent first`);
  }
  const card = src("src/features/assistant/PlanCard.tsx");
  assert.ok(card.includes('accessibilityRole="checkbox"'));
  assert.ok(card.includes('<T v="liveTitle" style={styles.tnum}>{title}</T>'), "the title carries a count: Jost with tabular figures, never Cormorant");
  assert.ok(/label=\{c\.undo\}[\s\S]{0,160}kind="ghost"/.test(card), "Undo is ivory; the Run button stays the one gold");
  const kb = src("src/ui/keyboard.tsx");
  assert.ok(kb.includes("restFromWindow: chat.rest + height"), "toasts clear the chat composer inside the native tabs");
  assert.ok(!/colors\.gold\b(?!Border|Light)/.test(card.replace(/border=\{proposed \? colors\.goldBorder/, "")), "the Run button is the card's one gold");
  const stream = src("src/features/assistant/stream.ts");
  assert.ok(stream.includes('t: "plan_step"') && stream.includes("keepStepIds?: string[]"));
});

console.log(`plan-card: ${n} checks passed`);
