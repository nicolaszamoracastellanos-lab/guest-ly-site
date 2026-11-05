// The day-of runsheet: blocks by day, add, template seed when empty, and the
// calendar file. A row opens its editor; its status opens a menu, and every
// status change can be undone (v1.2, B4).
// 1.4.0, each part only when the portal sends it (its flag on for the wedding):
//  #2  the lock line; on a locked timeline rows open "Request a change", the
//      header adds "Request a new moment", the open requests sit below the days
//      (Withdraw with Undo), and a person who may not mark sees D28's sentence
//      and a plain status badge, never a control that would be refused;
//  #9  the places of the day with Apple Maps and Google Maps (Add place and
//      edit while the timeline is open);
//  #40 the hair and makeup schedule under its block (in the list).

import React, { useCallback, useState } from "react";
import { View, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { failedText } from "@/features/shared/requests";
import { post, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import {
  Screen,
  TopBar,
  BigTitle,
  T,
  Button,
  Row,
  Stack,
  Skeleton,
  EmptyState,
  IconButton,
  toastError,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import {
  useCoupleRunsheet,
  RUNSHEET_KEY,
  type RunsheetBlock,
  type RunsheetStatus,
  type RunsheetSurface,
} from "@/features/runsheet/hooks";
import { RunsheetList, StatusMenu, UndoBar, statusChangedText } from "@/features/runsheet/list";
import { useSafeBack } from "@/lib/nav";
import { featureOn, useUserSession } from "@/lib/session";
import { lockView, openRequests, placesOn, requestsByBlock } from "@/features/runsheet/core";
import { LockLine, PlacesSection, RequestList, useChangeValue } from "@/features/runsheet/mw";
import { PlaceSheet } from "@/features/runsheet/PlaceSheet";
import { isLocked, useBlockActions } from "@/features/runsheet/actions";
import { useRunsheetStamp } from "@/features/seen/useRunsheetStamp";

export default function CoupleRunsheet() {
  const c = useFeatureCopy(COPY);
  const app = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const mainQuery = useCoupleRunsheet();
  const { data, isLoading, error } = mainQuery;
  const [seeding, setSeeding] = useState(false);
  const me = useUserSession()?.me;
  const actions = useBlockActions();
  const [placeEditing, setPlaceEditing] = useState<string | "new" | null>(null);
  // #37: this screen in focus is an open of the runsheet (the version GET gave).
  useRunsheetStamp((data as { version?: unknown } | undefined)?.version);

  const [menuFor, setMenuFor] = useState<RunsheetBlock | null>(null);
  const [undo, setUndo] = useState<{ block: RunsheetBlock; from: RunsheetStatus; text: string } | null>(null);
  const clearUndo = useCallback(() => setUndo(null), []);

  // Picked in the status menu: saved at once, with Undo for a few seconds.
  function pick(b: RunsheetBlock, status: RunsheetStatus) {
    setMenuFor(null);
    void setStatus(b, status).then((ok) => {
      if (ok) setUndo({ block: b, from: b.status, text: statusChangedText(c, b, status) });
    });
  }

  function undoLast() {
    if (!undo) return;
    const { block, from } = undo;
    setUndo(null);
    void setStatus(block, from);
  }

  async function setStatus(b: RunsheetBlock, status: RunsheetStatus): Promise<boolean> {
    qc.setQueryData<RunsheetSurface>(RUNSHEET_KEY, (cur) =>
      cur
        ? {
            ...cur,
            days: cur.days.map((d) => ({
              ...d,
              blocks: d.blocks.map((x) =>
                x.id === b.id ? { ...x, status } : x,
              ),
            })),
          }
        : cur,
    );
    try {
      await post(`/couple/runsheet/${b.id}/status`, { status });
      return true;
    } catch (err) {
      // D28: the one sentence; the refetch below turns the control into a badge.
      toastError(isLocked(err) ? c.lockedStatus : failedText(app.fail.blockStatus, err, lang));
      return false;
    } finally {
      void qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
    }
  }

  async function seed() {
    setSeeding(true);
    try {
      const next = await post<RunsheetSurface>("/couple/runsheet/seed", {});
      qc.setQueryData(RUNSHEET_KEY, next);
    } catch (err) {
      toastError(failedText(app.fail.startFromTemplate, err, lang));
    } finally {
      setSeeding(false);
    }
  }

  const lv = data ? lockView(data) : null;
  const canEdit = lv?.canEdit ?? false;
  const canRequest = lv?.canRequest ?? false;
  const requests = data?.lock ? openRequests(data.requests) : [];
  const waiting = requestsByBlock(requests);
  const show = useChangeValue({ vendors: data?.vendors, places: data?.places });
  // Places show only when the flag says so and the payload carries them.
  const places = data && placesOn(data) && featureOn(me, "MW_PLACES") ? data.places ?? [] : null;
  const addPath = "/couple/runsheet/new" as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
    <Screen query={mainQuery} refresh
      header={
        <TopBar
          onBack={back}
          title={c.title}
          right={
            <Row gap={8}>
              {data?.blocks_total ? (
                <IconButton
                  name="calendar-plus"
                  label={c.addCalendar}
                  onPress={() => Linking.openURL(data.ics_url)}
                />
              ) : null}
              {canEdit || canRequest ? (
                <IconButton
                  name="plus"
                  label={canRequest ? c.requestNew : c.addBlock}
                  onPress={() => router.push(addPath)}
                  testID="runsheet-add"
                />
              ) : null}
            </Row>
          }
        />
      }
      bottomInset={40}
    >
      {/* Locked: the lock line carries the page's one helper sentence. */}
      <BigTitle title={c.title} sub={lv?.locked ? undefined : c.intro} size={38} />
      {data?.lock ? <LockLine lock={data.lock} hint={false} markSentence={lv?.showMarkSentence ?? false} /> : null}
      {error instanceof ApiFailure ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {error.messages[lang]}
        </T>
      ) : null}
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={56} />
          <Skeleton h={56} />
          <Skeleton h={56} />
        </Stack>
      ) : null}
      {data?.pending ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {c.pendingDb}
        </T>
      ) : null}
      {data && !data.pending && !data.blocks_total ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState
            title={c.emptyTitle}
            body={c.emptyHint}
            action={
              canRequest ? (
                <Button label={c.requestNew} icon="plus" onPress={() => router.push(addPath)} />
              ) : canEdit ? (
                <Button
                  label={c.template}
                  icon="list"
                  onPress={seed}
                  loading={seeding}
                  disabled={!online}
                />
              ) : undefined
            }
          />
          {canEdit ? (
            <Button
              label={c.addBlock}
              kind="glass"
              icon="plus"
              onPress={() => router.push("/couple/runsheet/new")}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>
      ) : null}
      {data && data.blocks_total ? (
        <>
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
            {data.blocks_total === 1
              ? c.block
              : fmt(c.blocks, { n: data.blocks_total })}
            {canEdit ? ` · ${c.tapStatus}` : canRequest ? ` · ${c.lockedHint}` : lv?.locked ? "" : ` · ${c.readOnly}`}
          </T>
          <RunsheetList
            data={data}
            canEdit={(lv?.canMark ?? false) && online}
            onStatus={setMenuFor}
            waiting={waiting}
            onOpen={
              canEdit || canRequest
                ? (b) =>
                    router.push({
                      pathname: "/couple/runsheet/[id]",
                      params: { id: b.id },
                    })
                : undefined
            }
          />
          {canEdit || canRequest ? (
            <Button
              label={canRequest ? c.requestNew : c.addBlock}
              kind="glass"
              icon="plus"
              onPress={() => router.push(addPath)}
              style={{ marginTop: 22 }}
            />
          ) : null}
        </>
      ) : null}
      {data && !data.pending ? (
        // Below the days: the runsheet stays the first thing; each row with an
        // open request already says so.
        <RequestList
          requests={requests}
          role={data.lock?.can_request || data.can_edit ? "couple" : "viewer"}
          show={show}
          onWithdraw={online ? actions.withdraw : undefined}
        />
      ) : null}
      {data && !data.pending && places ? (
        <PlacesSection
          places={places}
          onAdd={canEdit && online ? () => setPlaceEditing("new") : undefined}
          onOpen={canEdit && online ? (p) => setPlaceEditing(p.id) : undefined}
        />
      ) : null}
    </Screen>
    <StatusMenu block={menuFor} onPick={pick} onClose={() => setMenuFor(null)} />
    <UndoBar text={undo?.text ?? null} onUndo={undoLast} onDismiss={clearUndo} />
    {places ? <PlaceSheet editing={placeEditing} onClose={() => setPlaceEditing(null)} /> : null}
    </View>
  );
}
