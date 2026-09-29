// One request: what changes, the conversation, approve (behind biometric
// unlock when enabled) or decline.

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import type { Copy } from "@/i18n/en";
import { post } from "@/lib/api";
import { useGuestsByIds } from "@/features/guests/hooks";
import { errorText } from "@/features/shared/requests";
import { useCoupleRequests } from "@/lib/hooks";
import { useSession, useUserSession } from "@/lib/session";
import { biometricPrompt } from "@/lib/biometric";
import { Screen, TopBar, T, Badge, Card, Row, Button, Input, Stack, SectionLabel, ButtonRow, IconButton, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";
import { requestTitle } from "./index";
import { useSafeBack } from "@/lib/nav";

export default function RequestDetail() {
  const copy = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const { biometricEnabled } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mainQuery = useCoupleRequests();
  const { data } = mainQuery;
  const r = data?.requests.find((x) => x.id === id);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | "comment" | null>(null);
  const canEdit = user?.me.can_edit ?? false;
  const needsTyped = r?.kind === "send_reminders" && (r.guest_ids.length > 1);

  async function act(kind: "approve" | "decline") {
    if (!r || busy) return;
    if (kind === "approve" && biometricEnabled) {
      const ok = await biometricPrompt(copy.requests.approveWith, copy.common.cancel);
      if (!ok) return;
    }
    setBusy(kind);
    try {
      // The comment box is its own draft: an unsent question is never sent as
      // the approval or decline note.
      await post(`/couple/requests/${r.id}/${kind}`, { confirm: confirm || undefined });
      await qc.invalidateQueries({ queryKey: ["couple-requests"] });
      await qc.invalidateQueries({ queryKey: ["couple-guests"] });
      await qc.invalidateQueries({ queryKey: ["couple-home"] });
      back();
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setBusy(null);
    }
  }

  async function comment() {
    if (!r || !note.trim() || !canEdit || busy) return;
    setBusy("comment");
    try {
      await post(`/planner/requests/${r.id}/comment`, { text: note.trim() });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["couple-requests"] });
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setBusy(null);
    }
  }

  // Names come with the request on current servers; otherwise one `?ids=`
  // lookup, not a search through the first page of the guest list.
  const lookup = useGuestsByIds(r && !r.guest_names?.length ? r.guest_ids : []);
  const names = r ? (r.guest_names?.length ? r.guest_names : r.guest_ids.map((g) => lookup.data?.find((x) => x.id === g)?.name ?? "").filter(Boolean)) : [];
  const changes = r ? describeChanges(r.payload as Record<string, unknown>, names, copy.requests.changeWords, copy.requests.changeFields) : [];

  return (
    <Screen query={mainQuery} header={<TopBar onBack={back} title={copy.requests.title} />} bottomInset={40} keyboard>
      <>
        {r ? (
          <>
            <Row gap={8} style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <Badge label={r.status === "open" ? copy.planner.awaiting : r.status === "approved" ? copy.planner.approved : r.status === "declined" ? copy.planner.declined : copy.planner.cancelled} kind={r.status === "open" ? "amber" : r.status === "approved" ? "green" : "mute"} />
              <T v="meta13" color={colors.ivory55} numberOfLines={2} style={{ flexShrink: 1 }}>
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
                    <Row key={i} gap={12} style={{ minHeight: 52, paddingVertical: 8, justifyContent: "space-between", borderBottomWidth: i === changes.length - 1 ? 0 : 1, borderBottomColor: colors.ivory09 }}>
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
              {canEdit ? (
                <Input accessibilityLabel={copy.requests.askQuestion} value={note} onChangeText={setNote} editable={busy !== "comment"} placeholder={copy.requests.askQuestion} right={<IconButton name="chev" label={copy.concierge.send} onPress={() => void comment()} />} onSubmitEditing={() => void comment()} returnKeyType="send" />
              ) : null}
            </Stack>
            {canEdit && needsTyped && r.status === "open" ? <Input accessibilityLabel={copy.rsvps.remindTyped} value={confirm} onChangeText={setConfirm} placeholder={copy.rsvps.remindTyped} autoCapitalize="characters" style={{ marginTop: 10 }} /> : null}
            {canEdit && r.status === "open" ? (
              <ButtonRow style={{ marginTop: 22 }}>
                <Button label={copy.requests.decline} kind="ghost" onPress={() => void act("decline")} loading={busy === "decline"} disabled={!!busy} />
                <Button label={copy.requests.approve} onPress={() => void act("approve")} loading={busy === "approve"} disabled={!!busy} icon={biometricEnabled ? "lock" : undefined} />
              </ButtonRow>
            ) : null}
            <T v="meta13" color={colors.ivory40} center style={{ marginTop: 14 }}>
              {copy.requests.always}
            </T>
          </>
        ) : data ? (
          // Gone from the list (resolved elsewhere, or a stale link).
          <EmptyState title={copy.requests.empty} action={<Button label={copy.common.back} small onPress={back} />} />
        ) : null}
      </>
    </Screen>
  );
}

/** Human lines for a request payload without inventing fields. Every word on
 *  screen comes from the copy: no raw enum, no English inside the Spanish app,
 *  and never an empty label (Part 9 audit, D-012 and D-020). */
export function describeChanges(p: Record<string, unknown>, names: string[], words: Copy["requests"]["changeWords"], fields: Copy["requests"]["changeFields"]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const who = names.filter(Boolean).join(", ") || words.guest;
  const field = (k: string) => (fields as Record<string, string>)[k] ?? k.replace(/_/g, " ");
  // The portal stores the seat count as additional_seats (the only key it
  // validates); add_seats and seats are older spellings. Reading only those
  // showed every request as +1, so a couple approving "+1" could add three.
  if (p.kind === "plus_one") {
    const n = [p.additional_seats, p.add_seats, p.seats].find((v) => typeof v === "number" && v > 0) as number | undefined;
    out.push({ label: who, value: `+${n ?? 1}` });
  }
  if (p.kind === "edit_guest" && p.patch && typeof p.patch === "object") {
    for (const [k, v] of Object.entries(p.patch as Record<string, unknown>)) out.push({ label: `${who} · ${field(k)}`, value: String(v) });
  }
  if (p.kind === "record_rsvp") out.push({ label: who, value: p.decline_all ? words.declined : words.rsvp });
  if (p.kind === "send_reminders") out.push({ label: names.filter(Boolean).join(", ") || words.pending, value: words.reminder });
  if (p.kind === "guest_help") out.push({ label: who, value: String(p.topic ?? "") });
  if (p.kind === "batch_edit" && Array.isArray(p.changes)) out.push({ label: who, value: fmt(words.edits, { n: p.changes.length }) });
  return out;
}
