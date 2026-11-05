// #5 plan card in the app's Coordinator chat (1.4.0, MW_PLAN_CARD). A checklist
// of the server's plain sentences, every line ticked and untickable, one
// "Run N actions" button and "Discard plan". After a run each line says its
// result; a line the plan created can be undone for 30 minutes, and the lines
// that failed or were not reached can be tried again. The same card as the
// portal's components/coordinator/plan-card.tsx, in the app's night kit.
//
// Built only from the server's card (readPlan), never from model text. The
// parent (AssistantView) owns the requests; this file draws and reports.

import React, { useEffect, useState } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Button, Card, Icon, Row, Stack, T } from "@/ui";
import { colors, HIT_TARGET } from "@/ui/tokens";
import type { ActionCard } from "./stream";
import { keepIds, nextUndoClose, planPhase, struck, undoOpen, type Plan, type PlanStep } from "./plan";
import { PLAN_AREA_ROUTE, PLAN_COPY, type PlanCopy } from "./planCopy";

type Lang = "en" | "es";

export type PlanCardProps = {
  card: ActionCard;
  plan: Plan;
  lang: Lang;
  canEdit: boolean;
  /** A run, retry or discard of this card is in flight. */
  busy: boolean;
  /** Another card is busy: this one waits. */
  locked: boolean;
  /** The line whose Undo is in flight. */
  undoBusy: string | null;
  error?: string;
  onRun: (keepStepIds: string[]) => void;
  onRetry: () => void;
  onDiscard: () => void;
  onUndo: (step: PlanStep) => void;
  onAskAgain?: (text: string) => void;
};

function StepMark({ status }: { status: PlanStep["status"] }) {
  // Running: the clock mark plus the word; the Run button carries the spinner (one per card).
  if (status === "running") return <Icon name="clock" size={18} color={colors.ivory70} />;
  if (status === "done") return <Icon name="check" size={18} color={colors.green} strokeWidth={2} />;
  if (status === "failed") return <Icon name="warning" size={18} color={colors.red} />;
  if (status === "unknown") return <Icon name="info" size={18} color={colors.amber} />;
  return <Icon name="x" size={16} color={colors.ivory55} />;
}

function statusWord(status: PlanStep["status"], c: PlanCopy): string {
  switch (status) {
    case "done":
      return c.step.done;
    case "failed":
      return c.step.failed;
    case "skipped":
      return c.step.skipped;
    case "undone":
      return c.step.undone;
    case "running":
      return c.step.running;
    case "unknown":
      return c.step.unknown;
    default:
      return c.step.pending;
  }
}

const plural = (n: number, one: string, other: string) => (n === 1 ? one : fmt(other, { n }));

export function PlanCard({ card, plan, lang, canEdit, busy, locked, undoBusy, error, onRun, onRetry, onDiscard, onUndo, onAskAgain }: PlanCardProps) {
  const c = useFeatureCopy(PLAN_COPY);
  const router = useRouter();
  // The card redraws when its window closes or a line's Undo runs out, so a
  // control never stays on screen past the moment the server would refuse it.
  const [now, setNow] = useState(() => Date.now());
  const phase = planPhase(card, plan, now);
  const wake = phase === "proposed" ? (card.expiresAtMs > now ? card.expiresAtMs : null) : nextUndoClose(plan, now);
  useEffect(() => {
    if (wake === null) return;
    const t = setTimeout(() => setNow(Date.now()), Math.min(Math.max(wake - Date.now() + 50, 0), 2_147_483_647));
    return () => clearTimeout(t);
  }, [wake]);

  const [ticked, setTicked] = useState<Set<string>>(() => new Set(plan.steps.map((s) => s.id)));
  const keep = keepIds(plan, ticked);
  const proposed = phase === "proposed";
  const closed = phase === "expired" || phase === "replaced" || phase === "discarded";
  const title = closed ? plural(plan.steps.length, c.titleNotRunOne, c.titleNotRun) : card.title[lang];

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={{ paddingLeft: 38 }} testID="plan-card">
      <Card kind="glass" padding={16} border={proposed ? colors.goldBorder : undefined}>
        <T v="liveTitle" style={styles.tnum}>{title}</T>
        {proposed && canEdit ? (
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
            {c.helper}
          </T>
        ) : null}

        <View style={{ marginTop: 10 }} accessibilityState={{ busy }}>
          {plan.steps.map((step, i) => {
            const area = c.area[step.area];
            const top = i === 0 ? null : styles.rule;
            if (proposed) {
              const on = ticked.has(step.id);
              return (
                <Pressable
                  key={step.id}
                  testID={`plan-step-${step.id}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={step.sentence[lang]}
                  accessibilityHint={c.tickHint}
                  accessibilityState={{ checked: on, disabled: !canEdit || busy }}
                  disabled={!canEdit || busy}
                  onPress={() => toggle(step.id)}
                  style={({ pressed }) => [styles.line, top, pressed && { opacity: 0.8 }]}
                >
                  <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={16} color={colors.night} strokeWidth={2.2} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <T v="body15" color={on ? colors.ivory : colors.ivory55}>
                      {step.sentence[lang]}
                    </T>
                    <T v="meta13" color={colors.ivory55}>
                      {area}
                    </T>
                  </View>
                </Pressable>
              );
            }
            const canUndo = undoOpen(step, now, canEdit);
            return (
              <View key={step.id} style={[styles.line, top]} testID={`plan-step-${step.id}`}>
                <View style={styles.mark}>
                  <StepMark status={step.status} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body15" color={struck(step.status) ? colors.ivory55 : colors.ivory} style={struck(step.status) && { textDecorationLine: "line-through" }}>
                    {step.sentence[lang]}
                  </T>
                  <Row gap={6} style={{ flexWrap: "wrap" }}>
                    <T v="meta13" color={colors.ivory55}>
                      {statusWord(step.status, c)} ·
                    </T>
                    {step.status === "done" ? (
                      <Pressable accessibilityRole="link" accessibilityLabel={fmt(c.openArea, { area })} onPress={() => router.push(PLAN_AREA_ROUTE[step.area] as never)} hitSlop={10}>
                        <T v="meta13" color={colors.ivory70} style={{ textDecorationLine: "underline" }}>
                          {fmt(c.openArea, { area })}
                        </T>
                      </Pressable>
                    ) : (
                      <T v="meta13" color={colors.ivory55}>
                        {area}
                      </T>
                    )}
                  </Row>
                  {step.error ? (
                    <T v="meta13" color={colors.red}>
                      {step.error[lang]}
                    </T>
                  ) : null}
                  {canUndo ? (
                    <Button
                      label={c.undo}
                      // Ivory, not the text kind's gold: a plan can hold several Undo lines.
                      kind="ghost"
                      small
                      full={false}
                      icon="undo"
                      haptic={false}
                      loading={undoBusy === step.id}
                      disabled={busy || locked || (undoBusy !== null && undoBusy !== step.id)}
                      onPress={() => onUndo(step)}
                      testID={`plan-undo-${step.id}`}
                      style={{ marginTop: 6 }}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {error && phase !== "expired" ? (
          <T v="meta13" color={colors.red} style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : null}

        {proposed ? (
          <Stack gap={8} style={{ marginTop: 14 }}>
            {canEdit && keep.length === 0 ? (
              <T v="meta13" color={colors.ivory55}>
                {c.noneTicked}
              </T>
            ) : null}
            <Button
              label={plural(keep.length, c.runOne, c.run)}
              small
              loading={busy}
              disabled={!canEdit || keep.length === 0 || locked}
              onPress={() => onRun(keep)}
              testID="plan-run"
            />
            <Button label={c.discard} small kind="glass" disabled={!canEdit || busy || locked} onPress={onDiscard} testID="plan-discard" />
            {!canEdit ? (
              <T v="meta13" color={colors.ivory55}>
                {c.readOnly}
              </T>
            ) : null}
          </Stack>
        ) : phase === "ran" && plan.retryable > 0 && canEdit ? (
          <Button
            label={plan.retryKind === "failed" ? plural(plan.retryable, c.retryFailedOne, c.retryFailed) : plural(plan.retryable, c.runRestOne, c.runRest)}
            small
            loading={busy}
            disabled={locked}
            onPress={onRetry}
            style={{ marginTop: 14 }}
            testID="plan-retry"
          />
        ) : closed ? (
          <Stack gap={8} style={{ marginTop: 12 }}>
            <T v="meta13" color={colors.ivory55}>
              {phase === "expired" ? c.expired : phase === "replaced" ? c.replaced : c.cancelled}
            </T>
            {phase === "expired" && plan.askAgain && canEdit && onAskAgain ? (
              <Button label={c.askAgain} small kind="glass" full={false} icon="replay" disabled={locked} onPress={() => onAskAgain(plan.askAgain!)} />
            ) : null}
          </Stack>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  tnum: { fontVariant: ["tabular-nums"] },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10, minHeight: HIT_TARGET },
  rule: { borderTopWidth: 1, borderTopColor: colors.ivory09 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.ivory40, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: colors.ivory, borderColor: colors.ivory },
  mark: { width: 24, height: 22, alignItems: "center", justifyContent: "center" },
});
