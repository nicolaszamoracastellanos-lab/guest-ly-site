// The planner's runsheet: the couple's day, read-only, as on the web.
// 1.4.0, each part only when the portal sends it (its flag on for the wedding):
//  #2  the lock: "Lock timeline" / "Unlock timeline" commits at once with Undo
//      (a draft: the card says so and offers "Release and lock"); the couple's
//      change requests with
//      Approve and Decline (optional note). A block that changed after the
//      request stays with both versions and "Apply anyway"; a deleted block
//      offers "Add as a new block". Read-only planners see the list only.
//  #9  the places of the day with Apple Maps and Google Maps.
//  #40 the hair and makeup schedule under its block (in the list).

import React, { useState } from "react";
import { Linking, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useLang, fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure, post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { failedText } from "@/features/shared/requests";
import {
  Screen,
  TopBar,
  BigTitle,
  T,
  Skeleton,
  Stack,
  EmptyState,
  IconButton,
  Row,
  Sheet,
  SheetActions,
  Input,
  SectionLabel,
  toast,
  toastError,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import { usePlannerRunsheet, PLANNER_RUNSHEET_KEY, type RunsheetSurface } from "@/features/runsheet/hooks";
import { RunsheetList } from "@/features/runsheet/list";
import { approveKey, approveOutcome, openRequests, runLockToggle, placesOn, requestsByBlock, type ChangeRequest, type FieldChange, type RunsheetLock } from "@/features/runsheet/core";
import { PlacesSection, PlannerLockRow, RequestList, useChangeValue } from "@/features/runsheet/mw";
import { useSafeBack } from "@/lib/nav";
import { useRouter } from "expo-router";
import { can, featureOn, useUserSession } from "@/lib/session";
import { DAYOF_COPY } from "@/features/dayof/copy";
import { useDayPack, useDayPackFlag } from "@/features/dayof/hooks";

type Stale = { id: string; kind: "stale" | "target_gone"; current: FieldChange[] };

export default function PlannerRunsheet() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const mainQuery = usePlannerRunsheet();
  const { data, isLoading, error } = mainQuery;
  // #30: with the open wedding's Day pack saved, the live day-of view is one tap away.
  const router = useRouter();
  const me = useUserSession()?.me;
  const live = useFeatureCopy(DAYOF_COPY);
  const packOn = useDayPackFlag() && can(me, "runsheet", "view");
  const pack = useDayPack("planner", me?.tenant.slug, packOn);
  const liveButton = packOn && pack.entry ? <IconButton name="clock" label={live.openLive} onPress={() => router.push("/planner/dayof" as never)} testID="runsheet-open-live" /> : null;

  const [lockBusy, setLockBusy] = useState(false);
  const [draft, setDraft] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stale, setStale] = useState<Stale | null>(null);
  const [declining, setDeclining] = useState<ChangeRequest | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [declineBusy, setDeclineBusy] = useState(false);

  const lock = data?.lock ?? null;
  const resolver = !!lock?.can_resolve;
  const requests = lock ? openRequests(data?.requests) : [];
  const show = useChangeValue({ vendors: data?.vendors, places: data?.places });
  const places = data && placesOn(data) && featureOn(me, "MW_PLACES") ? data.places ?? [] : null;
  const refresh = () => void qc.invalidateQueries({ queryKey: PLANNER_RUNSHEET_KEY });
  const patch = (fn: (cur: RunsheetSurface) => RunsheetSurface) => qc.setQueryData<RunsheetSurface | undefined>(PLANNER_RUNSHEET_KEY, (cur) => (cur ? fn(cur) : cur));
  const dropRequest = (id: string) => patch((cur) => ({ ...cur, requests: (cur.requests ?? []).filter((r) => r.id !== id) }));

  async function setLock(locked: boolean, release = false, undoable = true) {
    const before = data?.lock;
    if (!before) return;
    setLockBusy(true);
    const res = await runLockToggle(before, locked, {
      apply: (lock) => patch((cur) => ({ ...cur, lock })),
      send: () => post<{ lock: RunsheetLock | null }>("/planner/runsheet/lock", { locked, ...(release ? { release: true } : {}) }),
    });
    if (res.ok) {
      setDraft(false);
      toast(locked ? c.timelineLocked : c.timelineUnlocked, undoable ? { undo: () => void setLock(!locked, false, false) } : {});
    } else if (res.draft) {
      // The couple has not seen the draft yet: the card says so and offers
      // "Release and lock" until it is done (a state, not a passing toast).
      setDraft(true);
    } else {
      toastError(failedText(locked ? c.fail.lock : c.fail.unlock, res.err, lang));
    }
    setLockBusy(false);
    refresh();
  }

  async function approve(r: ChangeRequest, opts: { applyAnyway?: boolean; asNew?: boolean } = {}) {
    setBusyId(r.id);
    const prev = data;
    dropRequest(r.id);
    try {
      await post(`/planner/runsheet/requests/${r.id}/approve`, { ...(opts.applyAnyway ? { apply_anyway: true } : {}), ...(opts.asNew ? { as_new: true } : {}) }, { headers: { "Idempotency-Key": approveKey(r, opts) } });
      setStale(null);
      toast(fmt(c.requestApproved, { title: r.title }));
    } catch (err) {
      const f = err instanceof ApiFailure ? err : null;
      const outcome = approveOutcome(f);
      if (outcome === "already_resolved") {
        toast(c.alreadyAnswered, { icon: "info" });
      } else {
        if (prev) qc.setQueryData(PLANNER_RUNSHEET_KEY, prev);
        if (outcome === "stale" || outcome === "target_gone") {
          // Both versions: what the couple asked (the diff) and what is there now.
          const now = (f?.current?.[0] ?? null) as Record<string, unknown> | null;
          const current = outcome === "stale" && now ? r.changes.map((ch) => ({ field: ch.field, before: String(now[ch.field] ?? ""), after: ch.after })) : [];
          setStale({ id: r.id, kind: outcome, current });
        } else {
          toastError(failedText(c.fail.approve, err, lang));
        }
      }
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  async function decline() {
    const r = declining;
    if (!r) return;
    setDeclineBusy(true);
    try {
      await post(`/planner/runsheet/requests/${r.id}/decline`, declineNote.trim() ? { note: declineNote.trim().slice(0, 500) } : {});
      dropRequest(r.id);
      setDeclining(null);
      setDeclineNote("");
      if (stale?.id === r.id) setStale(null);
      toast(fmt(c.requestDeclined, { title: r.title }));
    } catch (err) {
      if (err instanceof ApiFailure && err.code === "already_resolved") {
        setDeclining(null);
        toast(c.alreadyAnswered, { icon: "info" });
      } else {
        toastError(failedText(c.fail.decline, err, lang));
      }
    } finally {
      setDeclineBusy(false);
      refresh();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
    <Screen query={mainQuery} refresh
      header={
        <TopBar
          onBack={back}
          title={c.title}
          right={
            data?.blocks_total || liveButton ? (
              <Row gap={8}>
                {liveButton}
                {data?.blocks_total ? (
                  <IconButton
                    name="calendar-plus"
                    label={c.addCalendar}
                    onPress={() => Linking.openURL(data.ics_url)}
                  />
                ) : null}
              </Row>
            ) : undefined
          }
        />
      }
      bottomInset={40}
    >
      <BigTitle title={c.title} sub={resolver ? c.plannerIntro : c.readOnly} size={38} />
      {error instanceof ApiFailure ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {error.messages[lang]}
        </T>
      ) : null}
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={56} />
          <Skeleton h={56} />
        </Stack>
      ) : null}
      {data?.pending ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {c.pendingDb}
        </T>
      ) : null}
      {lock && (lock.locked || resolver) ? <PlannerLockRow lock={online ? lock : { ...lock, can_resolve: false }} busy={lockBusy} draft={draft} onToggle={(v) => void setLock(v)} onRelease={() => void setLock(true, true)} /> : null}
      {data ? (
        <RequestList
          requests={requests}
          role={resolver && online ? "planner" : "viewer"}
          busyId={busyId}
          stale={stale}
          show={show}
          onApprove={(r, o) => void approve(r, o)}
          onDecline={(r) => {
            setDeclineNote("");
            setDeclining(r);
          }}
        />
      ) : null}
      {data && !data.pending && !data.blocks_total ? (
        <EmptyState title={c.emptyTitle} />
      ) : null}
      {data && data.blocks_total ? (
        <>
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 18 }}>
            {data.blocks_total === 1
              ? c.block
              : fmt(c.blocks, { n: data.blocks_total })}
          </T>
          <RunsheetList data={data} canEdit={false} waiting={requestsByBlock(requests)} />
        </>
      ) : null}
      {data && !data.pending && places ? <PlacesSection places={places} /> : null}
    </Screen>
    <Sheet
      visible={!!declining}
      onClose={() => setDeclining(null)}
      top={300}
      footer={<SheetActions onCancel={() => setDeclining(null)} onSave={() => void decline()} saveLabel={c.decline} saving={declineBusy} saveTestID="decline-send" />}
    >
      <T v="title26">{c.declineTitle}</T>
      <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }}>
        {declining?.title ?? ""}
      </T>
      <View style={{ marginTop: 14 }}>
        <SectionLabel>{c.declineNote}</SectionLabel>
        <Input accessibilityLabel={c.declineNote} value={declineNote} onChangeText={(t) => setDeclineNote(t.slice(0, 500))} multiline style={{ marginTop: 6, minHeight: 80, alignItems: "flex-start", paddingTop: 12 }} />
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
          {c.declineHint}
        </T>
      </View>
    </Sheet>
    </View>
  );
}
