// One request: what changes, the conversation, approve (behind biometric
// unlock when enabled) or decline.

import React, { useState } from "react";
import { View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang, relTime } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useCoupleRequests } from "@/lib/hooks";
import { useSession, useUserSession } from "@/lib/session";
import { biometricPrompt } from "@/lib/biometric";
import { Screen, TopBar, T, Badge, Card, Row, Button, Input, Stack, SectionLabel, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { requestTitle } from "./index";

export default function RequestDetail() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const { biometricEnabled } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCoupleRequests();
  const r = data?.requests.find((x) => x.id === id);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | "comment" | null>(null);
  const canEdit = user?.me.can_edit ?? false;
  const needsTyped = r?.kind === "send_reminders" && (r.guest_ids.length > 1);

  async function act(kind: "approve" | "decline") {
    if (!r) return;
    if (kind === "approve" && biometricEnabled) {
      const ok = await biometricPrompt(copy.requests.approveWith, copy.common.cancel);
      if (!ok) return;
    }
    setBusy(kind);
    try {
      await post(`/couple/requests/${r.id}/${kind}`, { note: note || undefined, confirm: confirm || undefined });
      await qc.invalidateQueries({ queryKey: ["couple-requests"] });
      await qc.invalidateQueries({ queryKey: ["couple-guests"] });
      await qc.invalidateQueries({ queryKey: ["couple-home"] });
      router.back();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  async function comment() {
    if (!r || !note.trim()) return;
    setBusy("comment");
    try {
      await post(`/planner/requests/${r.id}/comment`, { text: note.trim() });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["couple-requests"] });
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  const changes = r ? describeChanges(r.payload as Record<string, unknown>, r.guest_names ?? []) : [];

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.requests.title} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {r ? (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <Badge label={r.status === "open" ? copy.planner.awaiting : r.status === "approved" ? copy.planner.approved : r.status === "declined" ? copy.planner.declined : copy.planner.cancelled} kind={r.status === "open" ? "amber" : r.status === "approved" ? "green" : "mute"} />
              <T v="meta13" color={colors.ivory55}>
                {relTime(r.created_at, lang)} · {r.created_by_email}
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
                <Row key={t.id} gap={10} align="flex-end" style={{ justifyContent: t.author_role === "couple" ? "flex-end" : "flex-start" }}>
                  <View style={{ maxWidth: "84%", borderRadius: 18, padding: 12, backgroundColor: t.author_role === "couple" ? colors.gold : colors.glassSolidFill, borderWidth: t.author_role === "couple" ? 0 : 1, borderColor: "rgba(247,243,236,0.12)" }}>
                    <T v="body15" color={t.author_role === "couple" ? colors.night : colors.ivory90}>
                      {t.body}
                    </T>
                  </View>
                </Row>
              ))}
              <Input value={note} onChangeText={setNote} placeholder={copy.requests.askQuestion} right={<Icon name="chev" size={18} color={colors.goldLight} />} onSubmitEditing={comment} returnKeyType="send" />
            </Stack>
            {needsTyped && r.status === "open" ? <Input value={confirm} onChangeText={setConfirm} placeholder={copy.rsvps.remindTyped} autoCapitalize="characters" style={{ marginTop: 10 }} /> : null}
            {canEdit && r.status === "open" ? (
              <Row gap={8} style={{ marginTop: 22 }}>
                <View style={{ flex: 1 }}>
                  <Button label={copy.requests.decline} kind="ghost" onPress={() => act("decline")} loading={busy === "decline"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label={copy.requests.approve} onPress={() => act("approve")} loading={busy === "approve"} icon={biometricEnabled ? "lock" : undefined} />
                </View>
              </Row>
            ) : null}
            <T v="meta13" color={colors.ivory40} center style={{ marginTop: 14 }}>
              {copy.requests.always}
            </T>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Human lines for a request payload without inventing fields. */
export function describeChanges(p: Record<string, unknown>, names: string[]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const who = names.join(", ");
  if (p.kind === "plus_one") out.push({ label: who, value: `+${typeof p.add_seats === "number" ? p.add_seats : typeof p.seats === "number" ? p.seats : 1}` });
  if (p.kind === "edit_guest" && p.patch && typeof p.patch === "object") {
    for (const [k, v] of Object.entries(p.patch as Record<string, unknown>)) out.push({ label: `${who} · ${k}`, value: String(v) });
  }
  if (p.kind === "record_rsvp") out.push({ label: who, value: p.decline_all ? "declined" : "RSVP" });
  if (p.kind === "send_reminders") out.push({ label: who || "pending", value: "reminder" });
  if (p.kind === "guest_help") out.push({ label: who, value: String(p.topic ?? "") });
  if (p.kind === "batch_edit" && Array.isArray(p.changes)) out.push({ label: who, value: `${p.changes.length}` });
  return out;
}
