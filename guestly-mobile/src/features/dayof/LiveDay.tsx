// The wedding-day view (#30 with the #3 Now engine), read from the Day pack so
// it opens instantly and works with no signal. Layout from the approved
// mockup (master-wave-nov4/mockups/dayof/03-live-couple-*-390): page title,
// date and "Updated" time, "N done earlier", Now with minutes left and Mark
// done, Next, Later today with "Between: N min" rows. The "Running late" row
// of the mockup is not built (Nicolas, Nov 5).
//
// Now and Next come from the verbatim engine (./live.ts) every 30 s on the
// phone, in the wedding's zone, with the device clock corrected by the
// pack's server offset. Nothing animates: the text swaps and the gold
// diamond moves with "Now".

import React, { useMemo, useState } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { can, useUserSession } from "@/lib/session";
import { useCoupleDayOf, usePlannerCheckin } from "@/lib/hooks";
import { cancelQueued, newEventId, sendBlockStatus, type QueuedBlockStatus } from "@/lib/queue";
import { failedText } from "@/features/shared/requests";
import { clockLabel } from "@/features/guest/format";
import { useSafeBack } from "@/lib/nav";
import { Banner, Button, Gem, IconButton, Icon, Row, Screen, Skeleton, Stack, T, TopBar, toast, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { DAYOF_COPY } from "./copy";
import { PreviewBanner, PreviewDayControl, usePreviewActive } from "./PreviewDay";
import { useDayPack, useNow, usePackOwner, usePendingStatus, useQueuedGuestIds, useSettledOnline } from "./hooks";
import { patchBlockStatus, type PackKind } from "./packStore";
import { doorCounts, formatSize, isPackDay, packBanner, packPlanTables, withPendingStatus, type DayPack, type PackBlock } from "./packCore";
import { SeatingPlanMap } from "@/features/seating/TableShape";
import { COPY as SEATING_COPY } from "@/features/seating/copy";
import { liveState, sortByServiceOrder, usableTimeZone, wallClockAt, zoneOffsetMinutes, type LiveItem } from "./live";

type Role = "couple" | "planner";

function timeOf(hhmm: string, lang: "en" | "es"): string {
  return clockLabel(null, hhmm.slice(0, 5), lang);
}
function instantLabel(ms: number, tz: string, lang: "en" | "es"): string {
  return clockLabel(wallClockAt(ms, tz).minutes, null, lang);
}
function dayLabel(day: string, lang: "en" | "es"): string {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(lang === "es" ? "es-BO" : "en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** The live view for one wedding. Renders nothing of its own when the pack is
 *  missing on the portal (the caller shows the older screen instead). */
export function LiveDay({ role, slug }: { role: Role; slug: string }) {
  const c = useFeatureCopy(DAYOF_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const owner = usePackOwner();
  const me = useUserSession()?.me;
  const kind: PackKind = role;
  const { entry, status, refresh } = useDayPack<DayPack>(kind, slug);
  const online = useSettledOnline();
  const pending = usePendingStatus(slug);
  const queuedIds = useQueuedGuestIds(slug);
  const coupleCounts = useCoupleDayOf({ poll: online, enabled: role === "couple" });
  const plannerCounts = usePlannerCheckin({ poll: online, enabled: role === "planner" && can(me, "checkin", "view") });
  const server = role === "couple" ? coupleCounts.data : plannerCounts.data;
  const now = useNow(entry?.offsetMs ?? 0, slug);
  const previewOn = usePreviewActive(slug);
  // A preview's marks live only in `optimistic`: they go when it starts or ends (any way it ends).
  const [wasPreview, setWasPreview] = useState(previewOn);
  const [showDone, setShowDone] = useState(false);
  // Taps sent online that the saved pack does not show yet.
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  if (wasPreview !== previewOn) {
    setWasPreview(previewOn);
    setOptimistic({});
  }

  // Opening the screen is a foreground use: check the pack once (a 304 when
  // nothing changed), whatever the 7-day window says.
  const ready = status.ready;
  React.useEffect(() => {
    if (ready && online) void refresh();
  }, [ready, online, refresh]);

  const pack = entry?.pack ?? null;
  const tz = usableTimeZone(pack?.meta.tz);
  const view = useMemo(() => {
    if (!pack) return null;
    const overlay = [...pending.map((p) => ({ block_id: p.block_id, status: p.status })), ...Object.entries(optimistic).map(([block_id, s]) => ({ block_id, status: s }))];
    const { blocks, waiting } = withPendingStatus(pack.runsheet, overlay);
    const live = liveState(blocks, { now, timeZone: tz });
    return { blocks, waiting, live };
  }, [pack, pending, optimistic, now, tz]);

  const canMark = pack?.meta.can_mark_status !== false && (role === "couple" ? me?.can_edit !== false : can(me, "runsheet", "edit"));
  const packDay = pack && view ? isPackDay(pack, view.live.serviceDay) : false;
  const banner = packBanner({ online, savedAt: entry ? entry.checkedAt : null, now: now - (entry?.offsetMs ?? 0), packDay: (packDay && !previewOn) || (!pack && status.ready), refreshFailed: status.failed });
  const zoneDiffers = (() => {
    try {
      return zoneOffsetMinutes(tz, now) !== -new Date(now).getTimezoneOffset();
    } catch {
      return false;
    }
  })();
  const venue = (s: string) => (zoneDiffers ? `${s} (${c.venueTime})` : s);
  const savedTime = entry ? venue(instantLabel(entry.checkedAt + entry.offsetMs, tz, lang)) : "";

  async function setStatus(b: PackBlock, status: "done" | "planned" | "confirmed", previous: string, undoable: boolean) {
    if (!owner) return;
    // Demo "Preview the day": the tap changes only the preview, nothing is queued or sent.
    if (previewOn) {
      setOptimistic((o) => ({ ...o, [b.id]: status }));
      if (undoable)
        toast(fmt(c.previewMarked, { title: b.title }), {
          undo: () =>
            setOptimistic((o) => {
              const next = { ...o };
              delete next[b.id];
              return next;
            }),
        });
      return;
    }
    const item: QueuedBlockStatus = {
      kind: "block_status",
      client_event_id: newEventId(),
      block_id: b.id,
      status,
      tapped_at: new Date(now).toISOString(),
      base_updated_at: b.updated_at,
      name: b.title,
      path: `/${role}/runsheet/${encodeURIComponent(b.id)}/status`,
      tenant: slug,
    };
    setOptimistic((o) => ({ ...o, [b.id]: status }));
    const rollback = () =>
      setOptimistic((o) => {
        const next = { ...o };
        delete next[b.id];
        return next;
      });
    try {
      const r = await sendBlockStatus(item);
      if (r.kind === "sent") {
        await patchBlockStatus(owner, slug, b.id, status);
        rollback();
        void refresh();
      } else if (r.kind === "queued" || r.kind === "held") {
        rollback(); // the outbox overlay shows it from now on
      } else if (r.kind === "locked") {
        rollback();
        toast(c.locked, { icon: "info", ms: 6000 });
        return;
      } else {
        rollback();
        toastError(fmt(c.gone, { names: b.title }));
        void refresh();
        return;
      }
      if (!undoable) return;
      // Held: the phone is online but the status route is dark (the day pack
      // switched off, or a failed flag read). The connection is not to blame.
      const message = fmt(r.kind === "queued" ? c.markedDoneQueued : r.kind === "held" ? c.markedDoneHeld : c.markedDone, { title: b.title });
      toast(message, {
        undo: () => {
          void (async () => {
            // Still waiting in the outbox: take it back without a request.
            if ((r.kind === "queued" || r.kind === "held") && (await cancelQueued(item.client_event_id))) return;
            await setStatus(b, previous as "planned" | "confirmed" | "done", status, false);
          })();
        },
      });
    } catch (err) {
      rollback();
      toastError(failedText(fmt(c.statusFailed, { title: b.title }), err, lang));
    }
  }

  // ------------------------------------------------------------ states

  const header = (
    <TopBar
      onBack={back}
      right={entry ? <IconButton name="undo" label={c.refresh} onPress={() => void refresh()} testID="dayof-refresh" /> : undefined}
    />
  );

  const bannerNode =
    banner.kind === "offline" ? (
      <Banner kind="neutral" icon="wifi-off" title={fmt(c.offlineSaved, { time: savedTime })} />
    ) : banner.kind === "stale" ? (
      <Banner kind="amber" icon="clock" title={fmt(c.staleSaved, { time: savedTime })} />
    ) : banner.kind === "missing" ? (
      <Banner kind="red" icon="warning" title={c.missingTitle} body={c.missingBody} />
    ) : null;

  if (!pack || !view) {
    const waitingFirst = !status.ready || status.loading;
    return (
      <Screen header={header} refresh={() => refresh()}>
        <T v="screen" accessibilityRole="header">{c.title}</T>
        <View style={{ marginTop: 16, gap: 12 }}>
          {bannerNode}
          {waitingFirst && online ? (
            <Stack gap={12}>
              <Skeleton h={22} w="60%" />
              <Skeleton h={180} r={16} />
              <Skeleton h={64} />
              <Skeleton h={64} />
            </Stack>
          ) : (
            <Button label={status.loading ? c.saving : c.saveOffline} icon="down" kind="glass" loading={status.loading} onPress={() => void refresh()} disabled={!online} testID="dayof-save-offline" />
          )}
          {!online ? (
            <T v="meta13" color={colors.ivory55}>
              {c.needsConnection}
            </T>
          ) : null}
        </View>
      </Screen>
    );
  }

  const { live, waiting } = view;
  const today = live.items;
  const showDay = packDay ? live.serviceDay : (live.nextDay ?? pack.meta.wedding_date ?? live.serviceDay);
  const dayBlocks = packDay ? null : sortByServiceOrder(view.blocks.filter((b) => b.day === showDay));
  const doneEarlier = today.filter((i) => i.state === "done");
  const current = today.filter((i) => i.state === "now");
  const nextItem = today.find((i) => i.state === "next") ?? null;
  const later = today.filter((i) => i.state === "later");
  const gapBefore = new Map(live.gaps.map((g) => [g.beforeId, g]));
  const counts = doorCounts({ serverIn: server?.parties_in ?? null, total: server?.parties_total ?? null, roster: pack.roster, queuedGuestIds: queuedIds });
  const showDoor = role === "couple" || can(me, "checkin", "view");
  const planTables = packPlanTables(pack.seating);

  const meta = (i: { block: PackBlock; endMs: number; endEstimated: boolean }) =>
    [i.block.location, i.endEstimated ? null : fmt(c.until, { time: instantLabel(i.endMs, tz, lang) }), i.block.owner].filter(Boolean).join(" · ");

  return (
    <Screen header={header} refresh={() => refresh()}>
      <T v="screen" accessibilityRole="header">{c.title}</T>
      <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
        {[dayLabel(showDay, lang), previewOn ? null : fmt(c.updated, { time: savedTime })].filter(Boolean).join(" · ")}
      </T>
      {bannerNode ? <View style={{ marginTop: 14 }}>{bannerNode}</View> : null}
      <PreviewBanner slug={slug} now={now} timeZone={tz} />
      {previewOn ? null : <PreviewDayControl slug={slug} blocks={pack.runsheet} timeZone={tz} day={pack.meta.wedding_date ?? showDay} />}

      {!view.blocks.length ? (
        <Stack gap={12} style={{ marginTop: 24 }}>
          <T v="body15" color={colors.ivory70}>{c.noBlocks}</T>
          <Button label={c.openRunsheet} kind="glass" onPress={() => router.push(`/${role}/runsheet` as never)} />
        </Stack>
      ) : null}

      {packDay && doneEarlier.length ? (
        <Pressable
          onPress={() => setShowDone((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDone }}
          accessibilityLabel={showDone ? c.hideDone : doneEarlier.length === 1 ? c.doneEarlierOne : fmt(c.doneEarlier, { n: doneEarlier.length })}
          style={styles.doneRow}
          testID="dayof-done-earlier"
        >
          <T v="body15" color={colors.ivory70}>
            {doneEarlier.length === 1 ? c.doneEarlierOne : fmt(c.doneEarlier, { n: doneEarlier.length })}
          </T>
          <Icon name={showDone ? "up" : "down"} size={18} color={colors.ivory55} />
        </Pressable>
      ) : null}
      {packDay && showDone
        ? doneEarlier.map((i) => <LaterRow key={i.block.id} time={timeOf(i.block.starts_at, lang)} title={i.block.title} meta={meta(i)} done />)
        : null}

      {packDay ? (
        <>
          <Row gap={10} style={{ marginTop: 22 }}>
            <Gem size={9} />
            <T v="body16" color={colors.ivory}>{c.now}</T>
          </Row>
          <View style={styles.nowCard} accessibilityLiveRegion="polite">
            {current.length ? (
              current.map((i, n) => (
                <NowBlock
                  key={i.block.id}
                  item={i}
                  first={n === 0}
                  now={now}
                  lang={lang}
                  meta={meta(i)}
                  waiting={waiting.has(i.block.id)}
                  canMark={canMark}
                  onDone={() => void setStatus(i.block, "done", i.block.status, true)}
                />
              ))
            ) : live.gap ? (
              <T v="liveTitle">{fmt(c.between, { n: live.gap.remaining })}</T>
            ) : (
              <T v="body15" color={colors.ivory70}>{live.phase === "after" ? c.allDone : c.nothingNow}</T>
            )}
          </View>

          {nextItem ? (
            <>
              <T v="body16" color={colors.ivory70} style={{ marginTop: 22 }}>{c.next}</T>
              <View style={styles.nextRow}>
                <Row style={{ justifyContent: "space-between" }} align="baseline">
                  <T v="live22">{timeOf(nextItem.block.starts_at, lang)}</T>
                  {live.minutesToNext !== null ? <T v="body15" color={colors.ivory70} style={styles.tnum}>{fmt(c.inMin, { n: live.minutesToNext })}</T> : null}
                </Row>
                <T v="liveTitle" style={{ marginTop: 4 }}>{nextItem.block.title}</T>
                {meta(nextItem) ? <T v="meta13" color={colors.ivory55}>{meta(nextItem)}</T> : null}
              </View>
            </>
          ) : null}

          {later.length ? (
            <>
              <T v="body16" color={colors.ivory70} style={{ marginTop: 22, marginBottom: 4 }}>{c.laterToday}</T>
              {later.map((i) => (
                <React.Fragment key={i.block.id}>
                  {gapBefore.has(i.block.id) && gapBefore.get(i.block.id)!.minutes > 0 ? <GapRow text={fmt(c.between, { n: gapBefore.get(i.block.id)!.minutes })} /> : null}
                  <LaterRow time={timeOf(i.block.starts_at, lang)} title={i.block.title} meta={meta(i)} waiting={waiting.has(i.block.id)} waitingLabel={c.waitingSync} />
                </React.Fragment>
              ))}
            </>
          ) : null}
        </>
      ) : dayBlocks && dayBlocks.length ? (
        <>
          <Row gap={10} style={{ marginTop: 18 }}>
            <Icon name="info" size={18} color={colors.ivory55} />
            <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>{c.notToday}</T>
          </Row>
          <View style={{ marginTop: 12 }}>
            {dayBlocks.map((b) => (
              <LaterRow key={b.id} time={timeOf(b.starts_at, lang)} title={b.title} meta={[b.location, b.owner].filter(Boolean).join(" · ")} />
            ))}
          </View>
        </>
      ) : null}

      {showDoor ? (
        <View style={styles.door}>
          <T v="body16" color={colors.ivory70}>{c.door}</T>
          <Row style={{ justifyContent: "space-between", marginTop: 6 }} align="baseline">
            <T v="body15" style={styles.tnum}>
              {counts.total !== null ? fmt(c.doorCount, { in: counts.in, total: counts.total }) : String(counts.in)}
            </T>
            {counts.waiting ? <T v="meta13" color={colors.amber} style={styles.tnum}>{fmt(c.doorWaiting, { n: counts.waiting })}</T> : null}
          </Row>
          <Button label={c.checkIn} icon="qr" kind="glass" onPress={() => router.push(`/${role}/checkin` as never)} style={{ marginTop: 12 }} />
        </View>
      ) : null}

      {planTables.length ? (
        // #55: the plan saved on the phone, every table in its own shape where it stands.
        <View style={styles.door}>
          <T v="body16" color={colors.ivory70} style={{ marginBottom: 10 }}>{SEATING_COPY[lang].planTitle}</T>
          <SeatingPlanMap tables={planTables} lang={lang} testID="dayof-seating-plan" />
        </View>
      ) : null}

      <Row gap={8} style={{ marginTop: 22 }} align="flex-start">
        <Icon name="check" size={16} color={colors.ivory55} />
        <T v="meta13" color={colors.ivory55} style={[{ flex: 1 }, styles.tnum]} testID="dayof-ready-offline">
          {fmt(c.readyOfflineLine, { time: venue(instantLabel(entry!.savedAt + entry!.offsetMs, tz, lang)), size: formatSize(entry!.bytes, lang) })}
        </T>
      </Row>
    </Screen>
  );
}

function NowBlock({ item, first, now, lang, meta, waiting, canMark, onDone }: { item: LiveItem<PackBlock>; first: boolean; now: number; lang: "en" | "es"; meta: string; waiting: boolean; canMark: boolean; onDone: () => void }) {
  const c = DAYOF_COPY[lang];
  const left = Math.max(0, Math.ceil((item.endMs - now) / 60_000));
  const progress = Math.min(1, Math.max(0, (now - item.startMs) / Math.max(1, item.endMs - item.startMs)));
  return (
    <View style={[!first && styles.nowSplit]}>
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
          <Button label={c.markDone} icon="check" kind="glass" small full={false} onPress={onDone} testID="dayof-mark-done" />
        </View>
      ) : null}
      {waiting ? (
        <T v="meta13" color={colors.amber} style={{ marginTop: 8 }}>{c.waitingSync}</T>
      ) : null}
    </View>
  );
}

function LaterRow({ time, title, meta, done, waiting, waitingLabel }: { time: string; title: string; meta: string; done?: boolean; waiting?: boolean; waitingLabel?: string }) {
  return (
    <Row gap={14} align="flex-start" style={styles.laterRow}>
      <T v="live22" color={done ? colors.ivory40 : colors.ivory} style={styles.timeCol} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {time}
      </T>
      <View style={{ flex: 1 }}>
        <T v="body16" color={done ? colors.ivory40 : colors.ivory}>{title}</T>
        {meta ? <T v="meta13" color={colors.ivory55}>{meta}</T> : null}
        {waiting && waitingLabel ? <T v="meta13" color={colors.amber}>{waitingLabel}</T> : null}
      </View>
    </Row>
  );
}

function GapRow({ text }: { text: string }) {
  return (
    <Row gap={10} style={{ paddingVertical: 10 }}>
      <View style={styles.dash} />
      <T v="meta13" color={colors.ivory55} style={styles.tnum}>{text}</T>
      <View style={styles.dash} />
    </Row>
  );
}

const styles = StyleSheet.create({
  tnum: { fontVariant: ["tabular-nums"] },
  doneRow: { marginTop: 18, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.ivory14, paddingHorizontal: 4 },
  nowCard: { marginTop: 12, borderRadius: 16, backgroundColor: colors.navy, padding: 18 },
  nowSplit: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.ivory14 },
  track: { marginTop: 12, height: 3, borderRadius: 2, backgroundColor: colors.ivory14, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.ivory70 },
  nextRow: { marginTop: 8, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.ivory14 },
  laterRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.ivory09 },
  timeCol: { width: 104 },
  dash: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.ivory25 },
  door: { marginTop: 26, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.ivory14 },
});
