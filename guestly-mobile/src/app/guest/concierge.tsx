// Concierge chat: proxies to the engine through the portal. Quick chips,
// typing indicator, escalation bubble. Drafts survive an app restart.

import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useGuestSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Chip, Row, Input, Icon, Badge, IconButton } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM } from "@/ui/tokens";

type Turn = { role: "user" | "assistant"; content: string; escalated?: boolean };
const DRAFT_KEY = "gl.concierge.draft";
const HISTORY_KEY = "gl.concierge.history";

export default function Concierge() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const insets = useSafeAreaInsets();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(() => `app-${Math.random().toString(36).slice(2, 10)}`);
  const scroll = useRef<ScrollView>(null);
  const name = session?.guest.name.split(" ")[0] ?? "";

  useEffect(() => {
    AsyncStorage.multiGet([DRAFT_KEY, HISTORY_KEY]).then(([[, d], [, h]]) => {
      if (d) setDraft(d);
      if (h) {
        try {
          setTurns(JSON.parse(h) as Turn[]);
        } catch {
          // ignore
        }
      }
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(DRAFT_KEY, draft).catch(() => {});
  }, [draft]);
  useEffect(() => {
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-30))).catch(() => {});
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [turns]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setDraft("");
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await post<{ reply: string; escalated: boolean }>("/guest/concierge", { message: msg, session_id: sessionId, history });
      setTurns((t) => [...t, { role: "assistant", content: r.reply, escalated: r.escalated }]);
    } catch (err) {
      setTurns((t) => [...t, { role: "assistant", content: err instanceof ApiFailure ? err.messages[lang] : copy.common.error }]);
    } finally {
      setBusy(false);
    }
  }

  const chips = [copy.concierge.chips.dressCode, copy.concierge.chips.hotels, copy.concierge.chips.gifts];
  const bottomPad = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 12;

  return (
    <Screen
      scroll={false}
      padded={false}
      bottomInset={0}
      header={<TopBar onBack={() => router.back()} right={<IconButton name="chat" onPress={() => router.push("/guest/messages")} label={copy.messages.title} />} />}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <Row gap={12} style={{ paddingHorizontal: 24, marginTop: 12 }}>
          <Avatar gem size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title26">{copy.concierge.title}</T>
            <T v="meta13" color={colors.ivory55}>
              {copy.concierge.subtitle}
            </T>
          </View>
        </Row>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Bubble role="assistant" text={fmt(copy.concierge.hello, { name })} />
          {turns.map((t, i) => (
            <Bubble key={i} role={t.role} text={t.content} escalated={t.escalated} escalatedLabel={copy.concierge.escalated} />
          ))}
          {busy ? (
            <Row gap={10}>
              <Avatar gem size={28} />
              <View style={[styles.bot, { flexDirection: "row", gap: 8, alignItems: "center" }]}>
                <ActivityIndicator color={colors.goldLight} size="small" />
                <T v="meta13" color={colors.ivory55}>
                  {copy.concierge.typing}
                </T>
              </View>
            </Row>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: bottomPad, gap: 8 }}>
          <Row gap={8}>
            {chips.map((c) => (
              <Chip key={c} label={c} onPress={() => send(c)} />
            ))}
          </Row>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={copy.concierge.placeholder}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => send(draft)}
            style={{ paddingRight: 6 }}
            right={
              <Pressable onPress={() => send(draft)} accessibilityRole="button" accessibilityLabel={copy.concierge.placeholder} style={styles.send} disabled={busy || !draft.trim()}>
                <Icon name="chev" size={20} color={colors.night} strokeWidth={2} />
              </Pressable>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ role, text, escalated, escalatedLabel }: { role: "user" | "assistant"; text: string; escalated?: boolean; escalatedLabel?: string }) {
  if (role === "user") {
    return (
      <View style={{ alignItems: "flex-end" }}>
        <View style={styles.me}>
          <T v="body15" color={colors.night}>
            {text}
          </T>
        </View>
      </View>
    );
  }
  return (
    <Row gap={10} align="flex-end">
      <Avatar gem size={28} />
      <View style={{ flex: 1, gap: 6, alignItems: "flex-start" }}>
        <View style={[styles.bot, escalated && { borderColor: "rgba(245,158,11,0.35)" }]}>
          <T v="body15" color={colors.ivory90}>
            {text}
          </T>
        </View>
        {escalated && escalatedLabel ? <Badge label={escalatedLabel} kind="amber" /> : null}
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  bot: { maxWidth: 290, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, paddingHorizontal: 14, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  me: { maxWidth: 270, borderRadius: 18, borderBottomRightRadius: 4, padding: 12, paddingHorizontal: 14, backgroundColor: colors.gold },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
});
