// #3 Planner Today, the app half (MW_LIVE_DAY, 1.4.0): every wedding of the
// planner that is live today, one row each with its Now line, soonest next
// start first, with the venue's time difference when it is not the phone's.
// A tap makes that wedding the open one and opens its day-of view. No
// diamond here: three Now lines would triple the mark (L1's web Today).
//
// Data: GET /planner/agenda `live[]` (the server's answer per wedding at its
// server_now); minutes tick on the phone through the verbatim engine, every
// 30 s, corrected by the server offset (features/dayof/liveDayCore). Renders
// nothing when the key is missing (flag off on every wedding, a build or a
// portal without it) or empty.

import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Card, ListRow, SectionLabel, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { clockLabel } from "@/features/guest/format";
import { useNow } from "@/features/dayof/hooks";
import { clockOffset, diffParts, liveLine, readLiveList, sortLive, venueDiffMinutes, type LiveLine } from "@/features/dayof/liveDayCore";
import { COPY, type PlannerCopy } from "./copy";
import { useWorkOnWedding } from "./Cockpit";

export function LiveToday({ raw, receivedAt }: { raw: unknown; receivedAt: number }) {
  const l = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const work = useWorkOnWedding();
  const list = useMemo(() => readLiveList(raw), [raw]);
  // One answer, one server clock: every wedding shares the offset.
  const offset = list && list.length ? clockOffset(list[0].live.serverNow, receivedAt) : 0;
  const now = useNow(offset);
  if (!list || !list.length) return null;
  const device = -new Date(now).getTimezoneOffset();
  const rows = sortLive(list.map((w) => ({ ...w, line: liveLine(w.live, now) })));

  return (
    <Card kind="solid" padding={16}>
      <SectionLabel color={colors.goldLight} style={{ marginBottom: 4 }}>
        {l.liveToday}
      </SectionLabel>
      {rows.map((w, i) => {
        const zone = zoneText(l, venueDiffMinutes(w.live.timeZone, now, device));
        return (
          <ListRow
            key={w.slug}
            title={w.names}
            sub={lineText(l, w.line, lang)}
            below={
              zone ? (
                <T v="meta13" color={colors.ivory55} style={{ fontVariant: ["tabular-nums"] }}>
                  {zone}
                </T>
              ) : undefined
            }
            onPress={() =>
              void (async () => {
                if (await work(w.slug, w.names)) router.push("/planner/dayof" as never);
              })()
            }
            last={i === rows.length - 1}
            testID={`planner-live-${w.slug}`}
          />
        );
      })}
    </Card>
  );
}

function at(hhmm: string, lang: "en" | "es"): string {
  return clockLabel(null, hhmm.slice(0, 5), lang);
}

export function lineText(l: PlannerCopy, line: LiveLine, lang: "en" | "es"): string {
  switch (line.kind) {
    case "now":
      return line.more > 0 ? fmt(l.liveNowMore, { title: line.title, n: line.minutes, more: line.more }) : fmt(l.liveNow, { title: line.title, n: line.minutes });
    case "between":
      return fmt(l.liveBetween, { n: line.minutes, time: at(line.next.startsAt, lang), title: line.next.title });
    case "before":
      return fmt(l.liveBefore, { time: at(line.next.startsAt, lang), title: line.next.title });
    case "stale":
      return l.liveStale;
    default:
      return l.liveWrap;
  }
}

/** "Venue time, 1 h behind you", or null when the venue keeps the phone's time. */
export function zoneText(l: PlannerCopy, diff: number): string | null {
  if (!diff) return null;
  const { h, m } = diffParts(diff);
  const d = h && m ? fmt(l.liveHoursMin, { h, m }) : h ? fmt(l.liveHours, { h }) : fmt(l.liveMin, { m });
  return fmt(diff < 0 ? l.liveBehind : l.liveAhead, { d });
}
