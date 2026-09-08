// One conversation: the transcript (guest, concierge, your replies), handled
// state, and the reply composer. App threads reply in-app; WhatsApp opens
// WhatsApp with the text; web threads have no return channel.

import React, { useEffect, useRef, useState } from "react";
import { View, KeyboardAvoidingView, Platform, Linking, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Row, Input, Button, Badge, Stack, Skeleton, Icon, Card } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/inbox/copy";
import { useConversation, type TranscriptLine } from "@/features/inbox/hooks";

export default function Conversation() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, refetch } = useConversation(id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [handling, setHandling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (data?.messages.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
  }, [data?.messages.length]);

  async function invalidate() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["couple-inbox"] }), qc.invalidateQueries({ queryKey: ["couple-conversation", id] }), qc.invalidateQueries({ queryKey: ["couple-home"] })]);
  }

  async function send() {
    if (!text.trim() || !data) return;
    setBusy(true);
    try {
      const r = await post<{ delivered: "app" | "whatsapp_link" | "noted"; whatsapp_link?: string | null }>(`/couple/messages/${id}/reply`, { text: text.trim() });
      if (r.delivered === "app") {
        setNote(c.sent(data.name));
        setText("");
        await refetch();
      } else if (r.delivered === "whatsapp_link" && r.whatsapp_link) {
        await Linking.openURL(r.whatsapp_link);
        setText("");
      } else {
        setNote(c.webHint);
      }
      await invalidate();
    } catch (err) {
      Alert.alert(err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  async function markHandled() {
    setHandling(true);
    try {
      await post(`/couple/messages/${id}/handled`, {});
      setNote(c.handledDone);
      await Promise.all([refetch(), invalidate()]);
    } catch (err) {
      Alert.alert(err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setHandling(false);
    }
  }

  const channelLabel = data ? (c.channel[data.channel] ?? data.channel) : "";

  return (
    <Screen scroll={false} padded={false} bottomInset={0} header={<TopBar onBack={() => router.back()} title={c.title} right={data?.whatsapp_link ? <Button label={c.openWhatsapp} kind="glass" small full={false} icon="phone" onPress={() => Linking.openURL(data.whatsapp_link!)} /> : undefined} />}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          {isLoading && !data ? (
            <Stack gap={10}>
              <Skeleton h={56} />
              <Skeleton h={80} />
            </Stack>
          ) : null}
          {data ? (
            <Row gap={14} style={{ marginBottom: 8 }}>
              <Avatar initials={data.initials} size={52} gem={data.channel === "app"} />
              <View style={{ flex: 1, gap: 6 }}>
                <T v="title26">{data.name}</T>
                <Row gap={6} style={{ flexWrap: "wrap" }}>
                  <Badge label={channelLabel} kind={data.channel === "app" ? "gold" : "mute"} />
                  {data.sentiment === "frustrated" ? <Badge label={c.frustrated} kind="red" /> : data.sentiment === "negative" ? <Badge label={c.upset} kind="red" /> : null}
                  {data.open_events > 0 ? <Badge label={c.openEvents(data.open_events)} kind="amber" dot /> : null}
                </Row>
                <T v="meta13" color={colors.ivory55}>
                  {c.started(relTime(data.started_at, lang))} · {c.messages(data.messages.length)}
                </T>
              </View>
            </Row>
          ) : null}
          {data ? (
            <Row gap={8} style={{ marginBottom: 6 }}>
              {data.guest_id ? (
                <Button label={c.viewGuest} kind="glass" small full={false} icon="guests" onPress={() => router.push({ pathname: "/couple/guests/[id]", params: { id: data.guest_id! } })} />
              ) : null}
              {canEdit && data.open_events > 0 ? <Button label={c.handled} kind="glass" small full={false} icon="check" loading={handling} onPress={markHandled} /> : null}
            </Row>
          ) : null}
          {(data?.messages ?? []).map((m) => (
            <Bubble key={m.id} m={m} name={data?.name ?? ""} onAddToBrain={(q) => router.push({ pathname: "/couple/brain/section/[key]", params: { key: "faq", gap: q } })} />
          ))}
          {note ? (
            <T v="body15" color={colors.greenText}>
              {note}
            </T>
          ) : null}
        </ScrollView>
        {data ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 8, gap: 8 }}>
            {!canEdit ? (
              <T v="meta13" color={colors.ivory55}>
                {c.readOnly}
              </T>
            ) : data.channel === "web" ? (
              <Card kind="solid" padding={12}>
                <T v="meta13" color={colors.ivory55}>
                  {c.webHint}
                </T>
              </Card>
            ) : (
              <>
                {data.channel === "whatsapp" ? (
                  <T v="meta13" color={colors.ivory55}>
                    {c.whatsappHint}
                  </T>
                ) : null}
                <Input
                  value={text}
                  onChangeText={setText}
                  placeholder={c.replyPlaceholder}
                  multiline
                  style={{ paddingRight: 6 }}
                  right={
                    <Button label={data.channel === "whatsapp" ? c.openWhatsapp : c.reply} kind="primary" small full={false} icon={data.channel === "whatsapp" ? "phone" : "chat"} loading={busy} disabled={!text.trim()} onPress={send} />
                  }
                />
              </>
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
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
        <T v="body15">{m.text}</T>
      </View>
      <Row gap={6} style={{ paddingHorizontal: 4, flexWrap: "wrap", justifyContent: guest ? "flex-start" : "flex-end" }}>
        <T v="meta13" color={colors.ivory40}>
          {guest ? name || c.guest : couple ? c.you : c.concierge} · {relTime(m.created_at, lang)}
        </T>
        {m.sentiment === "frustrated" || m.sentiment === "negative" ? <Badge label={m.sentiment === "frustrated" ? c.frustrated : c.upset} kind="red" /> : null}
        {m.needs_couple ? <Badge label={c.waiting} kind="amber" dot /> : null}
      </Row>
      {m.is_gap ? (
        <Row gap={6} style={{ paddingHorizontal: 4, alignSelf: "flex-end" }}>
          <Icon name="warning" size={14} color={colors.amber} />
          <T v="meta13" color={colors.amber}>
            {c.couldNotAnswer}
          </T>
          {m.gap_question ? (
            <T v="meta13" color={colors.goldLight} onPress={() => onAddToBrain(m.gap_question!)}>
              {c.addToBrain}
            </T>
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}
