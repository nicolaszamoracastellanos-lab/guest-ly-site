// Ask the live concierge, or preview how it would answer with unpublished edits.

import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { Screen, TopBar, BigTitle, Card, T, Input, Button, Segmented, Stack, Avatar, Row } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/brain/copy";
import { useDraft } from "@/features/brain/draft";
import { useBrain } from "@/features/brain/hooks";

type Mode = "live" | "draft";

export default function BrainPreview() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const draft = useDraft();
  const { data } = useBrain();
  const [mode, setMode] = useState<Mode>("live");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<{ q: string; a: string; mode: Mode }[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ reply: string }>("/couple/brain/preview", { question: q, mode, facts: mode === "draft" ? draft.facts : undefined });
      setTurns((t) => [{ q, a: r.reply, mode }, ...t]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : c.publishFailed);
    } finally {
      setBusy(false);
    }
  }

  const options = [{ value: "live" as Mode, label: c.modeLive }, ...(data?.preview_available === false ? [] : [{ value: "draft" as Mode, label: c.modeDraft }])];

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BigTitle title={c.askTitle} size={36} />
        <View style={{ marginTop: 16 }}>
          <Segmented<Mode> value={mode} options={options} onChange={setMode} />
        </View>
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
          {mode === "live" ? c.liveHint : c.draftHint}
        </T>
        <Stack gap={10} style={{ marginTop: 16 }}>
          <Input value={question} onChangeText={setQuestion} placeholder={c.askPlaceholder} multiline style={{ minHeight: 72, alignItems: "flex-start", paddingVertical: 12 }} returnKeyType="send" onSubmitEditing={ask} />
          <Button label={busy ? c.asking : c.ask} onPress={ask} loading={busy} disabled={!question.trim()} icon="sparkle" />
          {error ? (
            <T v="body15" color={colors.red}>
              {error}
            </T>
          ) : null}
        </Stack>
        <Stack gap={12} style={{ marginTop: 22 }}>
          {turns.map((t, i) => (
            <Card key={i} kind="solid" padding={14}>
              <T v="body16" color={colors.ivory90}>
                {t.q}
              </T>
              <Row gap={10} style={{ marginTop: 12, alignItems: "flex-start" }}>
                <Avatar gem size={28} />
                <View style={{ flex: 1 }}>
                  <T v="meta13" color={colors.goldLight}>
                    {t.mode === "live" ? c.modeLive : c.modeDraft}
                  </T>
                  <T v="body15" style={{ marginTop: 4 }}>
                    {t.a}
                  </T>
                </View>
              </Row>
            </Card>
          ))}
        </Stack>
      </KeyboardAvoidingView>
    </Screen>
  );
}
