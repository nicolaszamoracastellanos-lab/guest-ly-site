// #3 Live wedding-day mode on the couple's day-of screen when the Day pack is
// not on (MW_LIVE_DAY on, MW_DAY_PACK off or missing): the same Now / Next
// arrangement as the pack's live view (LiveDay.tsx, the approved mockup),
// fed by GET /couple/dayof `runsheet` and `live`. Now and Next come from the
// verbatim engine every 30 s with the server's clock offset, so the minutes
// tick and the next moment takes over without a request; the screen's 30 s
// poll brings the server's truth back.
//
// Mark done is optimistic with Undo (the moment's earlier status from the
// runsheet cache, else planned); a locked timeline (D28, 423 runsheet_locked)
// rolls back and says the sentence once. Nothing animates: text swaps and the
// gold diamond stays with Now.

import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import type { CoupleDayOf } from "@/lib/hooks";
import { failedText } from "@/features/shared/requests";
import { clockLabel } from "@/features/guest/format";
import { RUNSHEET_KEY, type RunsheetSurface } from "@/features/runsheet/hooks";
import { Button, Gem, Row, T, toast, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { DAYOF_COPY } from "./copy";
import { useNow } from "./hooks";
import { liveState, wallClockAt, type LiveItem, type LiveState } from "./live";
import { clockOffset, dayofBlocks, liveDayAllowed, readLive, venueDiffMinutes, type DayofBlock } from "./liveDayCore";

type Lang = "en" | "es";

function timeOf(hhmm: string, lang: Lang): string {
  return clockLabel(null, hhmm.slice(0, 5), lang);
}
function instantLabel(ms: number, tz: string, lang: Lang): string {
  return clockLabel(wallClockAt(ms, tz).minutes, null, lang);
}

/**
 * The live state of the couple's day for this answer, or null when the
 * screen should stay as it was (no `live`, a wedding that never shows it,
 * no runsheet). `overlay`: taps not answered yet.
 */
export function useServerLive(data: CoupleDayOf | undefined, receivedAt: number, slug: string | null | undefined, overlay: Record<string, string>) {
  const live = useMemo(() => (liveDayAllowed(slug) ? readLive(data?.live) : null), [data?.live, slug]);
  const offset = live ? clockOffset(live.serverNow, receivedAt) : 0;
  const now = useNow(offset, slug);
  return useMemo(() => {
    if (!live || !data) return null;
    const blocks = dayofBlocks(data.runsheet, data.runsheet_day ?? live.serviceDay, overlay);
    if (!blocks.length) return null;
    const state = liveState(blocks, { now, timeZone: live.timeZone });
    // Not this wedding's day (nothing on today's service day): the screen stays as it was.
    if (!state.items.length) return null;
    return { live, state, now, receivedAt: receivedAt + offset };
  }, [live, data, overlay, now, receivedAt, offset]);
}

export type ServerLiveView = NonNullable<ReturnType<typeof useServerLive>>;

/** The Now and Next panel, with Mark done for a person who may mark. */
export function ServerLivePanel({ view, canEdit, onOverlay, preview = false }: { view: ServerLiveView; canEdit: boolean; onOverlay: (id: string, status: string | null) => void; /** Demo "Preview the day": marks change only the preview, nothing is sent. */ preview?: boolean }) {
  const c = useFeatureCopy(DAYOF_COPY);
  const { lang } = useLang();
  const qc = useQueryClient();
  // D28: with the timeline locked and a planner on the wedding, the planner
  // marks; the runsheet answer says so when it was read (the server refuses anyway).
  const canMark = canEdit && qc.getQueryData<RunsheetSurface>(RUNSHEET_KEY)?.lock?.can_mark !== false;
  const [busy, setBusy] = useState<string | null>(null);
  const { state, live, now } = view;
  const tz = live.timeZone;
  const device = -new Date(now).getTimezoneOffset();
  const venue = (s: string) => (venueDiffMinutes(tz, now, device) ? `${s} (${c.venueTime})` : s);
  const current = state.items.filter((i) => i.state === "now");
  const nextItem = state.items.find((i) => i.state === "next") ?? null;

  const previousStatus = (id: string): string => {
    const rs = qc.getQueryData<RunsheetSurface>(RUNSHEET_KEY);
    const s = rs?.days?.flatMap((d) => d.blocks).find((b) => b.id === id)?.status;
    return s === "confirmed" || s === "planned" ? s : "planned";
  };

  async function mark(b: DayofBlock, status: string, undoable: boolean, previous: string) {
    if (busy) return;
    if (preview) {
      onOverlay(b.id, status);
      if (undoable) toast(fmt(c.previewMarked, { title: b.title }), { undo: () => onOverlay(b.id, null) });
      return;
    }
    setBusy(b.id);
    onOverlay(b.id, status);
    try {
      await post(`/couple/runsheet/${encodeURIComponent(b.id)}/status`, { status });
      await qc.invalidateQueries({ queryKey: ["couple-dayof"] });
      void qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      onOverlay(b.id, null);
      if (undoable) toast(fmt(c.markedDone, { title: b.title }), { undo: () => void mark(b, previous, false, status) });
    } catch (err) {
      onOverlay(b.id, null);
      if (err instanceof ApiFailure && err.code === "runsheet_locked") toast(c.locked, { icon: "info", ms: 6000 });
      else toastError(failedText(fmt(c.statusFailed, { title: b.title }), err, lang));
    } finally {
      setBusy(null);
    }
  }

  const meta = (i: LiveItem<DayofBlock>) => [i.block.location, i.endEstimated ? null : fmt(c.until, { time: instantLabel(i.endMs, tz, lang) })].filter(Boolean).join(" · ");
  const first = state.items.find((i) => i.state !== "done") ?? null;

  return (
    <View style={{ marginTop: 16 }} testID="dayof-live">
      <T v="meta13" color={colors.ivory55} style={styles.tnum}>
        {fmt(c.updated, { time: venue(instantLabel(view.receivedAt, tz, lang)) })}
      </T>
      <Row gap={10} style={{ marginTop: 14 }}>
        <Gem size={9} />
        <T v="body16" color={colors.ivory}>{c.now}</T>
      </Row>
      <View style={styles.nowCard} accessibilityLiveRegion="polite">
        {current.length ? (
          current.map((i, n) => (
            <NowRow key={i.block.id} item={i} first={n === 0} now={now} lang={lang} meta={meta(i)} canMark={canMark} busy={busy === i.block.id} onDone={() => void mark(i.block, "done", true, previousStatus(i.block.id))} />
          ))
        ) : state.gap ? (
          <T v="liveTitle" style={styles.tnum}>{fmt(c.between, { n: state.gap.remaining })}</T>
        ) : (
          <T v="body15" color={colors.ivory70}>
            {state.phase === "after" ? c.allDone : state.phase === "before" && first ? fmt(c.notStarted, { time: timeOf(first.block.starts_at, lang) }) : c.nothingNow}
          </T>
        )}
      </View>
      {nextItem ? (
        <>
          <T v="body16" color={colors.ivory70} style={{ marginTop: 18 }}>{c.next}</T>
          <View style={styles.nextRow}>
            <Row style={{ justifyContent: "space-between" }} align="baseline">
              <T v="live22">{timeOf(nextItem.block.starts_at, lang)}</T>
              {state.minutesToNext !== null ? <T v="body15" color={colors.ivory70} style={styles.tnum}>{fmt(c.inMin, { n: state.minutesToNext })}</T> : null}
            </Row>
            <T v="liveTitle" style={{ marginTop: 4 }}>{nextItem.block.title}</T>
            {meta(nextItem) ? <T v="meta13" color={colors.ivory55}>{meta(nextItem)}</T> : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

function NowRow({ item, first, now, lang, meta, canMark, busy, onDone }: { item: LiveItem<DayofBlock>; first: boolean; now: number; lang: Lang; meta: string; canMark: boolean; busy: boolean; onDone: () => void }) {
  const c = DAYOF_COPY[lang];
  const left = Math.max(0, Math.ceil((item.endMs - now) / 60_000));
  const progress = Math.min(1, Math.max(0, (now - item.startMs) / Math.max(1, item.endMs - item.startMs)));
  return (
    <View style={!first && styles.nowSplit}>
      <Row style={{ justifyContent: "space-between" }} align="baseline">
        <T v="live22">{timeOf(item.block.starts_at, lang)}</T>
        <T v="body15" color={colors.ivory90} style={styles.tnum}>{fmt(c.minLeft, { n: left })}</T>
      </Row>
      <T v="liveTitle" style={{ marginTop: 6 }}>{item.block.title}</T>
      {meta ? <T v="meta13" color={colors.ivory55} style={{ marginTop: 2 }}>{meta}</T> : null}
      <View style={styles.track} accessible={false} importantForAccessibility="no">
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      {canMark ? (
        <View style={{ marginTop: 12, alignItems: "flex-start" }}>
          <Button label={c.markDone} icon="check" kind="glass" small full={false} onPress={onDone} loading={busy} testID="dayof-mark-done" />
        </View>
      ) : null}
    </View>
  );
}

/** The list's state per row from the live engine (the server's state when the engine has none). */
export function liveRowState(state: LiveState<DayofBlock> | null | undefined, id: string, fallback: string): string {
  return state?.states[id] ?? fallback;
}

const styles = StyleSheet.create({
  tnum: { fontVariant: ["tabular-nums"] },
  nowCard: { marginTop: 12, borderRadius: 16, backgroundColor: colors.navy, padding: 18 },
  nowSplit: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.ivory14 },
  track: { marginTop: 12, height: 3, borderRadius: 2, backgroundColor: colors.ivory14, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.ivory70 },
  nextRow: { marginTop: 8, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.ivory14 },
});
