// One planner request: changes, conversation, reply, withdraw, change.
//
// Fetched by id (GET /planner/requests/{id}), starting from the list's copy
// when there is one, so a push or deep link opens it directly. Loading shows a
// skeleton; a request this wedding does not have says so with a way back
// (core review P1-15). An edit shows in the conversation as its own line. Reply is
// guarded against a double send, withdraw asks first (P2-24), and only the
// planner who filed a request is offered withdraw and change (the portal
// refuses anyone else).

import React, { useRef, useState } from "react";
import { View, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { usePlannerRequest } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Badge, Card, Row, Button, Stack, SectionLabel, ButtonRow, Skeleton, EmptyState, Composer, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { requestTitle } from "@/app/couple/requests/index";
import { describeChanges } from "@/app/couple/requests/[id]";
import { useSafeBack } from "@/lib/nav";

/** Kinds the new-request form can rebuild, so they can be changed. */
const EDITABLE_KINDS = ["plus_one", "edit_guest", "guest_help", "custom", "send_reminders"];

export default function PlannerRequestDetail() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mainQuery = usePlannerRequest(id ?? "");
  const { data: r, isLoading } = mainQuery;
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["planner-request", id] });
    await qc.invalidateQueries({ queryKey: ["planner-requests"] });
  };
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"reply" | "cancel" | null>(null);
  // A ref, not state: Return and a tap in the same frame both see it.
  const sending = useRef(false);
  const mine = !!r && (!r.created_by_email || r.created_by_email.toLowerCase() === (user?.me.user.email ?? "").toLowerCase());

  async function reply() {
    if (!r || !text.trim() || sending.current) return;
    sending.current = true;
    setBusy("reply");
    try {
      await post(`/planner/requests/${r.id}/comment`, { text: text.trim() });
      setText("");
      toast(copy.planner.b12.replySent);
      await refresh();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  function confirmWithdraw() {
    if (!r || busy) return;
    Alert.alert(copy.core.withdrawTitle, copy.core.withdrawBody, [
      { text: copy.common.cancel, style: "cancel" },
      { text: copy.planner.withdraw, style: "destructive", onPress: () => void withdraw() },
    ]);
  }

  async function withdraw() {
    if (!r) return;
    setBusy("cancel");
    try {
      await post(`/planner/requests/${r.id}/cancel`, {});
      await refresh();
      await qc.invalidateQueries({ queryKey: ["planner-home"] });
      back();
      toast(copy.planner.b12.withdrawn);
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  const changes = r ? describeChanges(r.payload as Record<string, unknown>, r.guest_names ?? [], copy.requests.changeWords, copy.requests.changeFields) : [];

  return (
    <Screen
      query={mainQuery}
      refresh
      header={<TopBar onBack={back} title={copy.planner.requests} />}
      bottomInset={40}
      // Build 12: the reply box is docked, like a chat composer: above the
      // tab bar at rest, right on the keyboard while typing, the last
      // message kept above it. Its Send used to sit under the field, below
      // the keyboard (audit K4, P/53).
      dock={
        r ? (
          <Composer
            value={text}
            onChangeText={setText}
            onSend={() => void reply()}
            placeholder={copy.planner.b12.replyPlaceholder}
            sendLabel={copy.planner.sendReply}
            busy={busy === "reply"}
            editable={busy !== "reply"}
            testID="planner-request-reply"
            sendTestID="planner-request-reply-send"
          />
        ) : undefined
      }
    >
      <>
        {!r && isLoading ? (
          <Stack gap={12}>
            <Skeleton h={24} w="40%" />
            <Skeleton h={34} w="80%" />
            <Skeleton h={120} r={18} />
          </Stack>
        ) : null}
        {r === null ? <EmptyState title={copy.core.requestMissingTitle} body={copy.core.requestMissingBody} action={<Button label={copy.common.back} kind="glass" small full={false} onPress={back} />} /> : null}
        {r ? (
          <>
            <Row gap={8} style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
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
              {(r.thread ?? []).map((t) =>
                t.event === "edited" ? (
                  // The portal's own line for an edit: centered, not a bubble.
                  <T key={t.id} v="meta13" color={colors.ivory55} center style={{ paddingVertical: 4 }}>
                    {`${copy.core.editedEntry} · ${relTime(t.created_at, lang)}`}
                  </T>
                ) : (
                <Row key={t.id} style={{ justifyContent: t.author_role === "planner" ? "flex-end" : "flex-start" }}>
                  <View style={{ maxWidth: "84%", borderRadius: 18, padding: 12, backgroundColor: t.author_role === "planner" ? colors.gold : colors.glassSolidFill, borderWidth: t.author_role === "planner" ? 0 : 1, borderColor: "rgba(247,243,236,0.12)" }}>
                    <T v="body15" color={t.author_role === "planner" ? colors.night : colors.ivory90}>
                      {t.body}
                    </T>
                  </View>
                </Row>
                )
              )}
            </Stack>
            {r.status === "open" && mine ? (
              <ButtonRow style={{ marginTop: 22 }}>
                <Button label={copy.planner.withdraw} kind="ghost" onPress={confirmWithdraw} loading={busy === "cancel"} disabled={busy !== null} />
                {EDITABLE_KINDS.includes(r.kind) ? (
                  // No edit endpoint exists: the form sends a new version and
                  // withdraws this one, and says so before it does (P1-14).
                  <Button label={copy.planner.editRequest} onPress={() => router.push({ pathname: "/planner/requests/new", params: { from: r.id } })} disabled={busy !== null} />
                ) : null}
              </ButtonRow>
            ) : null}
            <T v="meta13" color={colors.ivory40} center style={{ marginTop: 14 }}>
              {copy.planner.footer}
            </T>
          </>
        ) : null}
      </>
    </Screen>
  );
}
