// One planner request: changes, conversation, reply, withdraw.

import React, { useState } from "react";
import { View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { usePlannerRequests } from "@/lib/hooks";
import { Screen, TopBar, T, Badge, Card, Row, Button, Input, Stack, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";
import { requestTitle } from "@/app/couple/requests/index";
import { describeChanges } from "@/app/couple/requests/[id]";

export default function PlannerRequestDetail() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = usePlannerRequests();
  const r = data?.requests.find((x) => x.id === id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"reply" | "cancel" | null>(null);

  async function reply() {
    if (!r || !text.trim()) return;
    setBusy("reply");
    try {
      await post(`/planner/requests/${r.id}/comment`, { text: text.trim() });
      setText("");
      await qc.invalidateQueries({ queryKey: ["planner-requests"] });
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    if (!r) return;
    setBusy("cancel");
    try {
      await post(`/planner/requests/${r.id}/cancel`, {});
      await qc.invalidateQueries({ queryKey: ["planner-requests"] });
      router.back();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  const changes = r ? describeChanges(r.payload as Record<string, unknown>, r.guest_names ?? []) : [];

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.planner.requests} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {r ? (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <Badge label={r.status === "open" ? copy.planner.awaiting : r.status === "approved" ? copy.planner.approved : r.status === "declined" ? copy.planner.declined : copy.planner.cancelled} kind={r.status === "open" ? "amber" : r.status === "approved" ? "green" : "mute"} />
              <T v="meta13" color={colors.ivory55}>
                {fmt(copy.planner.filed, { when: relTime(r.created_at, lang) })}
              </T>
            </Row>
            <T v="title30" style={{ marginTop: 14 }}>
              {requestTitle(r, copy.planner.kinds)}
            </T>
            {r.note ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 10 }}>
                {r.note}
              </T>
            ) : null}
            {changes.length ? (
              <>
                <SectionLabel style={{ marginTop: 22 }}>{copy.planner.changes}</SectionLabel>
                <Card kind="solid" padding={2} style={{ paddingHorizontal: 18, marginTop: 8 }}>
                  {changes.map((c, i) => (
                    <Row key={i} style={{ minHeight: 52, justifyContent: "space-between", borderBottomWidth: i === changes.length - 1 ? 0 : 1, borderBottomColor: colors.ivory09 }}>
                      <T v="body16" style={{ flex: 1 }}>
                        {c.label}
                      </T>
                      <T v="body15" color={colors.goldLight}>
                        {c.value}
                      </T>
                    </Row>
                  ))}
                </Card>
              </>
            ) : null}
            <SectionLabel style={{ marginTop: 22 }}>{copy.planner.conversation}</SectionLabel>
            <Stack gap={8} style={{ marginTop: 8 }}>
              {(r.thread ?? []).map((t) => (
                <Row key={t.id} style={{ justifyContent: t.author_role === "planner" ? "flex-end" : "flex-start" }}>
                  <View style={{ maxWidth: "84%", borderRadius: 18, padding: 12, backgroundColor: t.author_role === "planner" ? colors.gold : colors.glassSolidFill, borderWidth: t.author_role === "planner" ? 0 : 1, borderColor: "rgba(247,243,236,0.12)" }}>
                    <T v="body15" color={t.author_role === "planner" ? colors.night : colors.ivory90}>
                      {t.body}
                    </T>
                  </View>
                </Row>
              ))}
              <Input value={text} onChangeText={setText} placeholder={copy.planner.replyToCouple} onSubmitEditing={reply} returnKeyType="send" />
              <Button label={copy.planner.replyToCouple} small kind="glass" onPress={reply} loading={busy === "reply"} disabled={!text.trim()} />
            </Stack>
            {r.status === "open" ? (
              <Row gap={8} style={{ marginTop: 22 }}>
                <View style={{ flex: 1 }}>
                  <Button label={copy.planner.withdraw} kind="ghost" onPress={withdraw} loading={busy === "cancel"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label={copy.planner.editRequest} onPress={() => router.push({ pathname: "/planner/requests/new", params: { from: r.id } })} />
                </View>
              </Row>
            ) : null}
            <T v="meta13" color={colors.ivory40} center style={{ marginTop: 14 }}>
              {copy.planner.footer}
            </T>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
