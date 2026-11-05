// Add a runsheet block. The day defaults to the wedding date. On a locked
// timeline (#2) the same form becomes "Request a new block": a change request
// to the planner, with a note. A save refused because the planner locked the
// timeline meanwhile turns into that request with the typing kept.

import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { failedText } from "@/features/shared/requests";
import { Screen, TopBar, BigTitle, Button, T, Input, SectionLabel, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/runsheet/copy";
import {
  useCoupleRunsheet,
  BlockFormFields,
  emptyForm,
  validate,
  toBody,
  RUNSHEET_KEY,
  type BlockForm,
} from "@/features/runsheet/hooks";
import { lockView, newRequestKey, placesOn } from "@/features/runsheet/core";
import { isLocked, useBlockActions } from "@/features/runsheet/actions";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

export default function NewBlock() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const actions = useBlockActions();
  const { data } = useCoupleRunsheet();
  const [form, setForm] = useState<BlockForm | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestKey = useRef(newRequestKey());
  const lv = data ? lockView(data) : null;
  const request = !!lv?.canRequest;
  const withPlace = data ? placesOn(data) : false;
  const current =
    form ?? emptyForm(data?.days[0]?.day ?? data?.wedding_date ?? null);
  // Anything typed asks before leaving (lib/unsaved).
  const leave = useUnsavedGuard(
    (form !== null && JSON.stringify(form) !== JSON.stringify(emptyForm(data?.days[0]?.day ?? data?.wedding_date ?? null))) || !!note.trim(),
  );
  // Every visit starts from a blank block, never the last one added.
  useFocusEffect(
    useCallback(
      () => () => {
        setForm(null);
        setNote("");
        setError(null);
        setNotice(null);
      },
      [],
    ),
  );

  async function save() {
    const v = validate(current, c);
    if (v) return setError(v);
    setError(null);
    setBusy(true);
    try {
      if (request) {
        await actions.sendRequest("add", null, toBody(current, withPlace), note, requestKey.current);
        requestKey.current = newRequestKey();
      } else {
        await post("/couple/runsheet", toBody(current, withPlace));
        await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      }
      setForm(null);
      setNote("");
      leave.release();
      back();
      if (request) toast(c.requestSent);
    } catch (err) {
      if (!request && isLocked(err)) {
        setNotice(c.lockedMeanwhile);
        await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      } else if (request) {
        setError(failedText(c.fail.sendRequest, err, lang));
      } else {
        setError(err instanceof ApiFailure ? err.messages[lang] : c.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<TopBar onBack={() => leave(back)} title={c.title} />}
      bottomInset={40}
      keyboard
    >
      <>
        <BigTitle title={request ? c.requestNew : c.newBlock} size={34} />
        {notice && request ? (
          <T v="body15" color={colors.ivory70} style={{ marginTop: 10 }}>
            {notice}
          </T>
        ) : null}
        <BlockFormFields
          form={current}
          onChange={setForm}
          vendors={data?.vendors ?? []}
          places={data?.places}
        />
        {request ? (
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
        ) : null}
        {error ? (
          <T v="body15" color={colors.red} style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : null}
        <Button
          label={request ? c.sendRequest : c.save}
          onPress={save}
          loading={busy}
          disabled={!online || busy}
          style={{ marginTop: 22 }}
        />
      </>
    </Screen>
  );
}
