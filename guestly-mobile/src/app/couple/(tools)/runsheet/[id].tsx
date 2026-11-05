// One runsheet block. Three ways in, decided by the server's payload:
//  - edit (timeline open, couple editor): Save; Delete commits at once with
//    Undo on the list (K7: the same block comes back);
//  - request (#2, the planner locked the timeline): the same fields, then
//    "What changes" (only the changed fields, before over after) and a note;
//    Send request, or Ask to remove;
//  - read (viewer, or locked without requests): the fields, nothing to press.
// A save refused because the planner locked the timeline meanwhile turns into
// the request with the typing kept.

import React, { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { failedText } from "@/features/shared/requests";
import { Screen, TopBar, BigTitle, Button, Skeleton, T, Input, SectionLabel, toast, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import {
  useCoupleRunsheet,
  BlockFormFields,
  formFromBlock,
  validate,
  toBody,
  RUNSHEET_KEY,
  type BlockForm,
} from "@/features/runsheet/hooks";
import { lockView, newRequestKey, placesOn, proposalChanges } from "@/features/runsheet/core";
import { RequestDiff, useChangeValue } from "@/features/runsheet/mw";
import { isLocked, useBlockActions } from "@/features/runsheet/actions";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

export default function EditBlock() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const actions = useBlockActions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mainQuery = useCoupleRunsheet();
  const { data } = mainQuery;
  const block = useMemo(
    () => data?.days.flatMap((d) => d.blocks).find((b) => b.id === id) ?? null,
    [data, id],
  );
  // The edits belong to one block id. Opening another block never shows or
  // saves the previous block's fields, even if this instance is reused.
  const [draft, setDraft] = useState<{ id: string; form: BlockForm } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"save" | "send" | "remove" | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestKey = useRef(newRequestKey());
  const form = draft && draft.id === id ? draft.form : null;
  const setForm = (f: BlockForm) => setDraft({ id, form: f });
  const errorText = error && error.id === id ? error.text : null;
  const setErrorText = (text: string | null) => setError(text ? { id, text } : null);
  const current = form ?? (block ? formFromBlock(block) : null);
  const lv = data ? lockView(data) : null;
  const withPlace = data ? placesOn(data) : false;
  const mode: "edit" | "request" | "read" = lv?.canEdit ? "edit" : lv?.canRequest ? "request" : "read";
  const changes = block && current && mode === "request" ? proposalChanges(block, current, withPlace) : [];
  const show = useChangeValue({ vendors: data?.vendors, places: data?.places });
  // Typed changes not saved yet ask before leaving (lib/unsaved).
  const leave = useUnsavedGuard(!!(mode !== "read" && form && block && (JSON.stringify(form) !== JSON.stringify(formFromBlock(block)) || note.trim())));

  async function save() {
    if (!current) return;
    const v = validate(current, c);
    if (v) return setErrorText(v);
    setErrorText(null);
    setBusy("save");
    try {
      await post(`/couple/runsheet/${id}`, toBody(current, withPlace));
      await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      setDraft(null);
      leave.release();
      back();
    } catch (err) {
      if (isLocked(err)) {
        // Locked meanwhile: read the lock, keep the typing, offer the request.
        setNotice(c.lockedMeanwhile);
        await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      } else {
        setErrorText(err instanceof ApiFailure ? err.messages[lang] : c.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function sendChange() {
    if (!current || !block) return;
    const v = validate(current, c);
    if (v) return setErrorText(v);
    if (!changes.length) return setErrorText(c.nothingChanged);
    setErrorText(null);
    setBusy("send");
    try {
      await actions.sendRequest("edit", block.id, toBody(current, withPlace), note, requestKey.current);
      requestKey.current = newRequestKey();
      setDraft(null);
      setNote("");
      leave.release();
      back();
      toast(c.requestSent);
    } catch (err) {
      setErrorText(failedText(c.fail.sendRequest, err, lang));
    } finally {
      setBusy(null);
    }
  }

  async function askRemove() {
    if (!block) return;
    setBusy("remove");
    try {
      const r = await actions.sendRequest("remove", block.id, null, note, newRequestKey());
      setDraft(null);
      setNote("");
      leave.release();
      back();
      toast(fmt(c.removeSent, { title: block.title }), { undo: () => actions.withdraw(r) });
    } catch (err) {
      toastError(failedText(c.fail.sendRequest, err, lang));
    } finally {
      setBusy(null);
    }
  }

  function remove() {
    if (!block) return;
    leave.release();
    back();
    actions.deleteBlock(block, withPlace);
  }

  return (
    <Screen query={mainQuery}
      header={<TopBar onBack={() => leave(back)} title={mode === "request" ? c.requestChange : c.editBlock} />}
      bottomInset={40}
      keyboard
    >
      <>
        <BigTitle title={current?.title || c.editBlock} size={34} />
        {!current ? (
          <Skeleton h={300} r={18} style={{ marginTop: 20 }} />
        ) : (
          <>
            {notice && mode === "request" ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 10 }} testID="runsheet-locked-meanwhile">
                {notice}
              </T>
            ) : null}
            <BlockFormFields
              form={current}
              onChange={setForm}
              vendors={data?.vendors ?? []}
              places={data?.places}
              disabled={mode === "read"}
            />
            {mode === "request" ? (
              <>
                {changes.length ? (
                  <View style={{ marginTop: 20 }} testID="runsheet-what-changes">
                    <SectionLabel>{c.whatChanges}</SectionLabel>
                    <View style={{ marginTop: 8 }}>
                      <RequestDiff changes={changes} show={show} />
                    </View>
                  </View>
                ) : null}
                <View style={{ marginTop: 18 }}>
                  <SectionLabel>{c.noteForPlanner}</SectionLabel>
                  <Input
                    accessibilityLabel={c.noteForPlanner}
                    value={note}
                    onChangeText={(t) => setNote(t.slice(0, 500))}
                    multiline
                    style={{ marginTop: 6, minHeight: 72, alignItems: "flex-start", paddingTop: 12 }}
                  />
                </View>
              </>
            ) : null}
            {errorText ? (
              <T v="body15" color={colors.red} style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
                {errorText}
              </T>
            ) : null}
            {mode === "edit" ? (
              <>
                <Button label={c.save} onPress={save} loading={busy === "save"} disabled={!online || !!busy} style={{ marginTop: 22 }} />
                <Button label={c.delete} kind="ghost" onPress={remove} disabled={!online || !!busy} style={{ marginTop: 10 }} testID="runsheet-delete" />
              </>
            ) : mode === "request" ? (
              <>
                <Button label={c.sendRequest} onPress={sendChange} loading={busy === "send"} disabled={!online || !!busy} style={{ marginTop: 22 }} testID="runsheet-send-request" />
                <Button label={c.askRemove} kind="ghost" onPress={askRemove} loading={busy === "remove"} disabled={!online || !!busy} style={{ marginTop: 10 }} />
              </>
            ) : (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 18 }}>
                {c.readOnly}
              </T>
            )}
          </>
        )}
      </>
    </Screen>
  );
}
