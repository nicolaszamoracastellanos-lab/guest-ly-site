// Edit one runsheet block.

import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, del, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Button, Skeleton, T } from "@/ui";
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
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

export default function EditBlock() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
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
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const form = draft && draft.id === id ? draft.form : null;
  const setForm = (f: BlockForm) => setDraft({ id, form: f });
  const errorText = error && error.id === id ? error.text : null;
  const setErrorText = (text: string | null) => setError(text ? { id, text } : null);
  const current = form ?? (block ? formFromBlock(block) : null);
  const canEdit = data?.can_edit ?? false;
  // Typed changes not saved yet ask before leaving (lib/unsaved).
  const leave = useUnsavedGuard(!!(canEdit && form && block && JSON.stringify(form) !== JSON.stringify(formFromBlock(block))));

  async function save() {
    if (!current) return;
    const v = validate(current, c);
    if (v) return setErrorText(v);
    setErrorText(null);
    setBusy("save");
    try {
      await post(`/couple/runsheet/${id}`, toBody(current));
      await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      setDraft(null);
      leave.release();
      back();
    } catch (err) {
      setErrorText(err instanceof ApiFailure ? err.messages[lang] : c.error);
    } finally {
      setBusy(null);
    }
  }

  function remove() {
    Alert.alert(c.delete, c.deleteConfirm, [
      { text: c.cancel, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await del(`/couple/runsheet/${id}`);
            await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
            leave.release();
            back();
          } catch (err) {
            setErrorText(err instanceof ApiFailure ? err.messages[lang] : c.error);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen query={mainQuery}
      header={<TopBar onBack={() => leave(back)} title={c.editBlock} />}
      bottomInset={40}
      keyboard
    >
      <>
        <BigTitle title={current?.title || c.editBlock} size={34} />
        {!current ? (
          <Skeleton h={300} r={18} style={{ marginTop: 20 }} />
        ) : (
          <>
            <BlockFormFields
              form={current}
              onChange={setForm}
              vendors={data?.vendors ?? []}
              disabled={!canEdit}
            />
            {errorText ? (
              <T v="body15" color={colors.red} style={{ marginTop: 12 }}>
                {errorText}
              </T>
            ) : null}
            {canEdit ? (
              <>
                <Button
                  label={c.save}
                  onPress={save}
                  loading={busy === "save"}
                  disabled={!online || !!busy}
                  style={{ marginTop: 22 }}
                />
                <Button
                  label={c.delete}
                  kind="ghost"
                  onPress={remove}
                  loading={busy === "delete"}
                  disabled={!online || !!busy}
                  style={{ marginTop: 10 }}
                />
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
