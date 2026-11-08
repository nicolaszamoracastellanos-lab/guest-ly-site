// #1 the final count on the couple's guest list (1.4.0, MW_FINAL_COUNT): the
// state as an icon and a word (computed by the server in the wedding's zone),
// the due date or who locked it, the live totals and the menu per person, and
// "Lock final count" / "Unlock count" for editors. Lock commits at once with
// Undo, never a confirm (quality bar 5.3); a refusal puts the card back.
// Renders nothing without `final_count` (flag off, or a portal before #1).

import React, { useRef, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, plural, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { del, post } from "@/lib/api";
import { failedText } from "@/features/shared/requests";
import { dayMonth } from "@/features/guest/format";
import { Button, Card, Icon, Row, Stack, T, toast, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { FINAL_COUNT_COPY } from "./copy";
import { countBadge, lockedDay as lockedDayOf, mealLine, readFinalCount, runCountLock, type FinalCount } from "./core";

const TONE = { green: colors.greenText, red: colors.red, amber: colors.amber, mute: colors.ivory55 } as const;

export function FinalCountCard({ data, online }: { data: unknown; online: boolean }) {
  const c = useFeatureCopy(FINAL_COUNT_COPY);
  const { lang } = useLang();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const beforeLock = useRef<FinalCount | null>(null);
  const fc = readFinalCount(data);
  if (!fc) return null;
  const b = countBadge(fc);
  const word =
    b.key === "soon"
      ? plural(b.days ?? 0, c.badges.soon)
      : b.key === "upcoming"
        ? fmt(c.badges.upcoming, { n: b.days ?? 0 })
        : c.badges[b.key];
  // locked_at is an instant: the day it was in this phone's zone, as on the web.
  const lockedDay = lockedDayOf(fc.locked_at, lang);
  const line = fc.state === "locked" ? (lockedDay ? (fc.locked_by ? fmt(c.lockedOnBy, { date: lockedDay, name: fc.locked_by }) : fmt(c.lockedOn, { date: lockedDay })) : null) : fc.due ? fmt(c.dueOn, { date: dayMonth(fc.due, lang) }) : null;
  const meals = fc.meals.map((m) => ({ id: m.id, label: m.label, line: mealLine(m, c.noChoice) })).filter((m) => m.line);

  const apply = (next: FinalCount) =>
    qc.setQueriesData<Record<string, unknown> | undefined>({ queryKey: ["couple-rsvps"] }, (cur) => (cur && cur.final_count ? { ...cur, final_count: next } : cur));

  async function toggle(locked: boolean, undoable = true) {
    const current = readFinalCount(qc.getQueryData(["couple-rsvps", "pending"]) ?? data);
    if (!current || busy) return;
    if (locked) beforeLock.current = current;
    setBusy(true);
    const res = await runCountLock(current, locked, new Date().toISOString(), {
      apply,
      send: () => (locked ? post<{ locked: boolean; locked_at: string | null }>("/couple/rsvps/lock", {}) : del<{ locked: boolean }>("/couple/rsvps/lock")),
    }, beforeLock.current);
    setBusy(false);
    if (res.ok) toast(locked ? c.locked : c.unlocked, undoable ? { undo: () => void toggle(!locked, false) } : {});
    else toastError(failedText(locked ? c.fail.lock : c.fail.unlock, res.err, lang));
    void qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
  }

  return (
    <View testID="final-count">
    <Card kind="solid" padding={16} radiusKey="tile">
      <Row gap={10} style={{ flexWrap: "wrap" }}>
        <T v="body16" style={{ flexShrink: 1 }}>
          {c.title}
        </T>
        {/* Sentence case, an icon and a word (never color alone, never an uppercase tag). */}
        <Row gap={6}>
          <Icon name={b.icon} size={16} color={TONE[b.tone]} />
          <T v="meta13" color={TONE[b.tone]} style={{ fontVariant: ["tabular-nums"] }}>
            {word}
          </T>
        </Row>
      </Row>
      <Stack gap={4} style={{ marginTop: 8 }}>
        {line ? (
          <T v="meta13" color={colors.ivory70} style={{ fontVariant: ["tabular-nums"] }}>
            {line}
          </T>
        ) : null}
        <T v="meta13" color={colors.ivory70} style={{ fontVariant: ["tabular-nums"] }}>
          {fmt(c.totals, { attending: fc.attending, pending: fc.pending })}
        </T>
        {meals.map((m) => (
          <View key={m.id} accessible accessibilityLabel={`${m.label}: ${m.line}`}>
            <T v="meta13" color={colors.ivory55} style={{ fontVariant: ["tabular-nums"] }}>
              {m.label ? `${m.label}: ${m.line}` : m.line}
            </T>
          </View>
        ))}
      </Stack>
      {fc.can_lock && online ? (
        <Button
          label={fc.state === "locked" ? c.unlock : c.lock}
          icon={fc.state === "locked" ? "unlock" : "lock"}
          kind="glass"
          small
          loading={busy}
          onPress={() => void toggle(fc.state !== "locked")}
          style={{ marginTop: 12 }}
          testID="final-count-toggle"
        />
      ) : null}
    </Card>
    </View>
  );
}
