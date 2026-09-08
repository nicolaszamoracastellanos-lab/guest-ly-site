// Add a runsheet block. The day defaults to the wedding date.

import React, { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Button, T } from "@/ui";
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

export default function NewBlock() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const { data } = useCoupleRunsheet();
  const [form, setForm] = useState<BlockForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current =
    form ?? emptyForm(data?.days[0]?.day ?? data?.wedding_date ?? null);

  async function save() {
    const v = validate(current, c);
    if (v) return setError(v);
    setError(null);
    setBusy(true);
    try {
      await post("/couple/runsheet", toBody(current));
      await qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
      router.back();
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : c.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title={c.newBlock} />}
      bottomInset={40}
      keyboard
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <BigTitle title={c.newBlock} size={34} />
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
          loading={busy}
          disabled={!online}
          style={{ marginTop: 22 }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
