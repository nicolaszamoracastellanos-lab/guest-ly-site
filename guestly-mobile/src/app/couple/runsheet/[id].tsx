// Edit one runsheet block.

import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function EditBlock() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCoupleRunsheet();
  const block = useMemo(
    () => data?.days.flatMap((d) => d.blocks).find((b) => b.id === id) ?? null,
    [data, id],
  );
  const [form, setForm] = useState<BlockForm | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = form ?? (block ? formFromBlock(block) : null);

  async function save() {
    if (!current) return;
    const v = validate(current, c);
    if (v) return setError(v);
    setError(null);
    setBusy("save");
    try {
      await post(`/couple/runsheet/${id}`, toBody(current));
      await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      router.back();
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : c.error);
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
            router.back();
          } catch (err) {
            setError(err instanceof ApiFailure ? err.messages[lang] : c.error);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title={c.editBlock} />}
      bottomInset={40}
      keyboard
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <BigTitle title={current?.title || c.editBlock} size={34} />
        {!current ? (
          <Skeleton h={300} r={18} style={{ marginTop: 20 }} />
        ) : (
          <>
            <BlockFormFields
              form={current}
              onChange={setForm}
              vendors={data?.vendors ?? []}
            />
            {error ? (
              <T v="body15" color={colors.red} style={{ marginTop: 12 }}>
                {error}
              </T>
            ) : null}
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
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
