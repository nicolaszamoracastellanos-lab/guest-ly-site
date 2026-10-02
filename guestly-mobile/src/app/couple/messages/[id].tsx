// One conversation (build 12, M10): fixed header with the guest's name, the
// channel and "View card"; the transcript in the shared ChatList (opens on
// the newest message, the last one stays above the composer while typing,
// drag down puts the keyboard away); one composer that grows to 5 lines.
// Your reply shows at once as "Sending..." and then "Delivered". App threads
// reply in-app; WhatsApp opens WhatsApp with the text; web threads have no
// return channel.

import React, { useRef, useState } from "react";
import { View, Linking, Pressable } from "react-native";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Row, Button, Badge, Stack, Skeleton, Icon, Card, ChatList, ChatComposer, useKeyboardOpen, usePullRefresh, renderInlineBold, toast, type ChatListHandle } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/inbox/copy";
import { fetchEarlier, useConversation, type TranscriptLine } from "@/features/inbox/hooks";
import { useCoupleCopy } from "@/features/couple/ui";
import { useSafeBack } from "@/lib/nav";

type Outgoing = { key: string; text: string; at: string; status: "sending" | "delivered" | "failed"; error?: string };

export default function Conversation() {
  const c = useFeatureCopy(COPY);
  const cc = useCoupleCopy();
  const app = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { id } = useLocalSearchParams<{ id: string }>();
  const focused = useIsFocused();
  const mainQuery = useConversation(id, { poll: focused });
  const { data, isLoading, refetch } = mainQuery;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [handling, setHandling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const list = useRef<ChatListHandle>(null);
  const typing = useKeyboardOpen();
  // Older pages of a long thread. The query keeps polling the newest lines;
  // earlier ones are fetched on request and kept in front of them.
  const [earlier, setEarlier] = useState<TranscriptLine[]>([]);
  const [earlierMore, setEarlierMore] = useState<boolean | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const recent = data?.messages ?? [];
  const recentIds = new Set(recent.map((m) => m.id));
  const lines = [...earlier.filter((m) => !recentIds.has(m.id)), ...recent];
  const hasEarlier = earlierMore ?? data?.has_more ?? false;
  const channelLabel = data ? (c.channel[data.channel] ?? data.channel) : "";
  const fromConcierge = !!data && (data.gap_count > 0 || data.open_events > 0);
  // A delivered reply stays as its own bubble until the transcript has it.
  const coupleTexts = new Set(recent.filter((m) => m.role === "couple").map((m) => m.text.trim()));
  const pendingOut = outgoing.filter((o) => !(o.status === "delivered" && coupleTexts.has(o.text.trim())));
  // Pull down on the transcript to check for new messages now (S2).
  const pull = usePullRefresh(() => refetch());

  async function loadEarlier() {
    const first = lines[0];
    if (!first || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const r = await fetchEarlier(id, first.created_at);
      const known = new Set(lines.map((m) => m.id));
      setEarlier((prev) => [...r.messages.filter((m) => !known.has(m.id)), ...prev]);
      setEarlierMore(!!r.has_more && r.messages.length > 0);
    } catch (err) {
      toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function invalidate() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["couple-inbox"] }), qc.invalidateQueries({ queryKey: ["couple-conversation", id] }), qc.invalidateQueries({ queryKey: ["couple-home"] })]);
  }

  async function send(body: string, retryKey?: string) {
    const msg = body.trim();
    if (!msg || !data || busy) return;
    const whatsapp = data.channel === "whatsapp";
    const key = retryKey ?? `${Date.now()}`;
    setNote(null);
    if (!retryKey) setText("");
    // The bubble appears at once (D7); WhatsApp replies leave the app instead.
    if (!whatsapp) {
      setOutgoing((prev) => (retryKey ? prev.map((o) => (o.key === key ? { ...o, status: "sending", error: undefined } : o)) : [...prev, { key, text: msg, at: new Date().toISOString(), status: "sending" }]));
      requestAnimationFrame(() => list.current?.scrollToEnd(true));
    }
    setBusy(true);
    try {
      const r = await post<{ delivered: "app" | "whatsapp_link" | "noted"; whatsapp_link?: string | null }>(`/couple/messages/${id}/reply`, { text: msg });
      if (r.delivered === "app") {
        setOutgoing((prev) => prev.map((o) => (o.key === key ? { ...o, status: "delivered" } : o)));
        await refetch();
      } else if (r.delivered === "whatsapp_link" && r.whatsapp_link) {
        setOutgoing((prev) => prev.filter((o) => o.key !== key));
        await Linking.openURL(r.whatsapp_link);
        toast(cc.thread.openedWhatsapp, { icon: "info" });
      } else {
        setOutgoing((prev) => prev.filter((o) => o.key !== key));
        setNote(c.webHint);
      }
      await invalidate();
    } catch (err) {
      if (whatsapp) {
        setText(msg);
        toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
      } else {
        setOutgoing((prev) => prev.map((o) => (o.key === key ? { ...o, status: "failed", error: errorText(err, lang, app.common.errorBody) } : o)));
      }
    } finally {
      setBusy(false);
    }
  }

  async function markHandled() {
    setHandling(true);
    try {
      await post(`/couple/messages/${id}/handled`, {});
      toast(c.handledDone);
      await Promise.all([refetch(), invalidate()]);
    } catch (err) {
      toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
    } finally {
      setHandling(false);
    }
  }

  const header = (
    <View>
      <TopBar
        onBack={back}
        title={data ? data.name : c.title}
        right={data?.guest_id ? <Button label={cc.thread.viewCard} kind="glass" small full={false} onPress={() => router.push({ pathname: "/couple/guests/[id]", params: { id: data.guest_id! } })} testID="thread-view-card" /> : undefined}
      />
      {/* Who and where stay fixed above the transcript (K3); the extras fold
          away while typing so the last message keeps the room. */}
      {data ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory14 }}>
          <Row gap={6} style={{ flexWrap: "wrap" }}>
            <Icon name={data.channel === "whatsapp" ? "phone" : data.channel === "web" ? "globe" : "chat"} size={14} color={colors.ivory55} />
            <T v="meta13" color={colors.ivory70}>
              {channelLabel}
              {fromConcierge ? ` · ${cc.thread.fromConcierge}` : ""}
            </T>
            {typing ? null : data.sentiment === "frustrated" ? <Badge label={c.frustrated} kind="red" /> : data.sentiment === "negative" ? <Badge label={c.upset} kind="red" /> : null}
            {!typing && data.open_events > 0 ? <Badge label={c.openEvents(data.open_events)} kind="amber" dot /> : null}
          </Row>
          {!typing && canEdit && data.open_events > 0 ? <Button label={c.handled} kind="glass" small full={false} icon="check" loading={handling} onPress={markHandled} style={{ alignSelf: "flex-start" }} /> : null}
        </View>
      ) : null}
    </View>
  );

  const composer = !data ? null : !canEdit ? (
    <ChatComposer>
      <T v="meta13" color={colors.ivory55} center style={{ paddingVertical: 10 }}>
        {c.readOnly}
      </T>
    </ChatComposer>
  ) : data.channel === "web" ? (
    <ChatComposer>
      <Card kind="solid" padding={12}>
        <T v="meta13" color={colors.ivory70}>
          {c.webHint}
        </T>
      </Card>
    </ChatComposer>
  ) : (
    <ChatComposer
      value={text}
      onChangeText={setText}
      onSend={() => void send(text)}
      placeholder={data.channel === "whatsapp" ? cc.thread.replyWhatsapp : cc.thread.replyApp}
      sendLabel={data.channel === "whatsapp" ? c.openWhatsapp : app.common.send}
      busy={busy}
      testID="thread-input"
      sendTestID="thread-send"
      accessory={
        !typing && data.channel === "whatsapp" ? (
          <T v="meta13" color={colors.ivory55}>
            {c.whatsappHint}
          </T>
        ) : null
      }
    />
  );

  return (
    <Screen query={mainQuery} scroll={false} padded={false} keyboard="chat" header={header}>
      <ChatList ref={list} refreshControl={pull.control ?? undefined}>
        {isLoading && !data ? (
          <Stack gap={10}>
            <Skeleton h={56} />
            <Skeleton h={80} />
          </Stack>
        ) : null}
        {data && hasEarlier ? <Button label={c.earlier} kind="text" small loading={loadingEarlier} onPress={() => void loadEarlier()} /> : null}
        {data && !lines.length && !pendingOut.length ? (
          <View style={{ alignItems: "center", paddingVertical: 32, gap: 6 }}>
            <T v="body16">{cc.thread.emptyTitle(data.name.split(" ")[0] ?? data.name)}</T>
          </View>
        ) : null}
        {lines.map((m) => (
          <Bubble key={m.id} m={m} name={data?.name ?? ""} onAddToBrain={(q) => router.push({ pathname: "/couple/brain/section/[key]", params: { key: "faq", gap: q } })} />
        ))}
        {pendingOut.map((o) => (
          <Mine key={o.key} o={o} onRetry={() => void send(o.text, o.key)} />
        ))}
        {note ? (
          <T v="body15" color={colors.greenText}>
            {note}
          </T>
        ) : null}
      </ChatList>
      {composer}
    </Screen>
  );
}

function Mine({ o, onRetry }: { o: Outgoing; onRetry: () => void }) {
  const cc = useCoupleCopy();
  const failed = o.status === "failed";
  return (
    <Pressable onPress={failed ? onRetry : undefined} disabled={!failed} accessibilityRole={failed ? "button" : undefined} style={{ alignItems: "flex-end", gap: 4 }}>
      <View style={{ maxWidth: "86%", borderRadius: 18, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(201,169,110,0.22)", borderWidth: 1, borderColor: failed ? colors.red : colors.goldBorder, opacity: o.status === "sending" ? 0.75 : 1 }}>
        <T v="body15">{o.text}</T>
      </View>
      <Row gap={6} style={{ paddingHorizontal: 4 }}>
        {o.status === "delivered" ? <Icon name="check" size={14} color={colors.greenText} /> : failed ? <Icon name="warning" size={14} color={colors.red} /> : null}
        <T v="meta13" color={failed ? colors.red : o.status === "delivered" ? colors.greenText : colors.ivory55} accessibilityLiveRegion="polite">
          {o.status === "sending" ? cc.thread.sending : o.status === "delivered" ? cc.thread.delivered : cc.thread.failed}
        </T>
      </Row>
    </Pressable>
  );
}

function Bubble({ m, name, onAddToBrain }: { m: TranscriptLine; name: string; onAddToBrain: (q: string) => void }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const guest = m.role === "guest";
  const couple = m.role === "couple";
  return (
    <View style={{ alignItems: guest ? "flex-start" : "flex-end", gap: 4 }}>
      <View
        style={{
          maxWidth: "86%",
          borderRadius: 18,
          borderTopLeftRadius: guest ? 6 : 18,
          borderTopRightRadius: guest ? 18 : 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: guest ? colors.glassSolidFill : couple ? "rgba(201,169,110,0.22)" : "rgba(247,243,236,0.10)",
          borderWidth: 1,
          borderColor: m.is_gap ? "rgba(243,198,107,0.5)" : couple ? colors.goldBorder : colors.ivory14,
        }}
      >
        {m.role === "bot" ? (
          <Row gap={4} style={{ marginBottom: 4 }}>
            <Icon name="sparkle" size={12} color={colors.goldLight} />
            <T v="meta13" color={colors.goldLight}>
              {c.concierge}
            </T>
          </Row>
        ) : null}
        <T v="body15">{m.role === "bot" ? renderInlineBold(m.text) : m.text}</T>
      </View>
      <Row gap={6} style={{ paddingHorizontal: 4, flexWrap: "wrap", justifyContent: guest ? "flex-start" : "flex-end" }}>
        <T v="meta13" color={colors.ivory55}>
          {guest ? name || c.guest : couple ? c.you : c.concierge} · {relTime(m.created_at, lang)}
        </T>
        {m.sentiment === "frustrated" || m.sentiment === "negative" ? <Badge label={m.sentiment === "frustrated" ? c.frustrated : c.upset} kind="red" /> : null}
        {m.needs_couple ? <Badge label={c.waiting} kind="amber" dot /> : null}
      </Row>
      {m.is_gap ? (
        <View style={{ alignSelf: "stretch", alignItems: "flex-end", gap: 2, paddingHorizontal: 4 }}>
          <Row gap={6}>
            <Icon name="warning" size={14} color={colors.amber} />
            <T v="meta13" color={colors.amber}>
              {c.couldNotAnswer}
            </T>
          </Row>
          {m.gap_question ? (
            <Pressable onPress={() => onAddToBrain(m.gap_question!)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
              <T v="meta13" color={colors.goldLight}>
                {c.addToBrain}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
