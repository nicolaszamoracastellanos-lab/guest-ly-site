// Concierge chat: proxies to the engine through the portal. Quick chips,
// typing indicator, escalation bubble. Drafts survive an app restart.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang } from "@/i18n";
import { api } from "@/lib/api";
import { useGuestSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Chip, Row, Input, Icon, Badge, IconButton, KeyboardFill, Hairline, ChipRow, useKeyboardOpen, useBottomClearance, renderInlineBold } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { guestErrorText } from "@/features/guest/errors";

// `error` turns are local only: never sent back to the engine as history,
// never saved. `retry` is the question to send again.
type Turn = { role: "user" | "assistant"; content: string; escalated?: boolean; error?: boolean; retry?: string };
// Keys carry the wedding and the guest, so two guests on one phone never see
// each other's chat. The "gl.concierge." prefix is cleared on sign out.
const LEGACY_KEYS = ["gl.concierge.draft", "gl.concierge.history"];

export default function Concierge() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const session = useGuestSession();
  const qc = useQueryClient();
  const scope = session ? `guest:${session.tenant.slug}:${session.guest.id}` : "none";
  const draftKey = `gl.concierge.draft:${scope}`;
  const historyKey = `gl.concierge.history:${scope}`;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Saving waits until this identity's saved chat has been read, so a new
  // key never receives the previous guest's turns.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === historyKey;
  const [sessionId] = useState(() => `app-${Math.random().toString(36).slice(2, 10)}`);
  const scroll = useRef<ScrollView>(null);
  const name = session?.guest.name.split(" ")[0] ?? "";

  useEffect(() => {
    let cancelled = false;
    setTurns([]);
    setDraft("");
    // Unscoped keys from older builds could hold another guest's chat.
    AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
    AsyncStorage.multiGet([draftKey, historyKey])
      .then(([[, d], [, h]]) => {
        if (cancelled) return;
        if (d) setDraft(d);
        if (h) {
          try {
            const saved = JSON.parse(h) as Turn[];
            if (Array.isArray(saved)) setTurns(saved.filter((t) => t && !t.error && typeof t.content === "string"));
          } catch {
            // ignore a corrupt entry
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadedFor(historyKey);
      });
    return () => {
      cancelled = true;
    };
  }, [draftKey, historyKey]);
  // The draft is saved once typing pauses, not on every keystroke.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(draftKey, draft).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [draft, draftKey, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(historyKey, JSON.stringify(turns.filter((t) => !t.error).slice(-30))).catch(() => {});
  }, [turns, historyKey, loaded]);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [turns, busy]);

  const send = useCallback(async (text: string, retrying = false) => {
    const msg = text.trim();
    if (!msg || busy) return;
    if (!retrying) setDraft("");
    // Failed exchanges never go to the engine as history.
    const history = turns.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => (retrying ? t : [...t, { role: "user", content: msg }]));
    setBusy(true);
    try {
      // A real reply calls the AI engine, which can run well past the API
      // client's 20 s default (D-044: that default made a working connection
      // show "You seem to be offline" on every question). The couple and
      // planner assistant already gives itself 120 s for the same reason
      // (src/features/assistant/stream.ts); this screen now does too.
      const r = await api<{ reply: string; escalated: boolean }>("/guest/concierge", {
        method: "POST",
        body: { message: msg, session_id: sessionId, history },
        timeoutMs: 120_000,
      });
      setTurns((t) => [...t, { role: "assistant", content: r.reply, escalated: r.escalated }]);
      // The portal mirrors both lines into the guest's thread.
      void qc.invalidateQueries({ queryKey: ["guest-messages"] });
    } catch (err) {
      setTurns((t) => [...t, { role: "assistant", content: guestErrorText(err, copy, lang), error: true, retry: msg }]);
    } finally {
      setBusy(false);
    }
  }, [busy, turns, sessionId, qc, copy, lang]);

  /** Drops the failed answer and asks the same question again. */
  const retry = useCallback(
    (index: number) => {
      const t = turns[index];
      if (!t?.retry || busy) return;
      setTurns((all) => all.filter((_, i) => i !== index));
      void send(t.retry, true);
    },
    [turns, busy, send]
  );

  const chips = [copy.concierge.chips.dressCode, copy.concierge.chips.hotels, copy.concierge.chips.gifts];
  // Clear of the tab bar at rest; right on top of the keyboard while typing
  // (the tab bar is behind the keyboard then).
  const keyboardOpen = useKeyboardOpen();
  const { clearance } = useBottomClearance();
  const bottomPad = keyboardOpen ? 10 : clearance - 4;

  return (
    <Screen
      scroll={false}
      padded={false}
      bottomInset={0}
      header={<TopBar onBack={back} right={<IconButton name="chat" onPress={() => router.push("/guest/messages")} label={copy.messages.title} />} />}
    >
      <KeyboardFill>
        <Row gap={12} align="flex-start" style={{ paddingHorizontal: 24, marginTop: 4, paddingBottom: 12 }}>
          <Avatar gem size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title26">{copy.concierge.title}</T>
            <T v="meta13" color={colors.ivory55}>
              {copy.concierge.subtitle}
            </T>
          </View>
        </Row>
        <Hairline />
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Bubble role="assistant" text={fmt(copy.concierge.hello, { name })} />
          {turns.map((t, i) => (
            <Bubble
              key={i}
              role={t.role}
              text={t.content}
              escalated={t.escalated}
              escalatedLabel={copy.concierge.escalated}
              escalatedNote={copy.concierge.repliesInMessages}
              onOpenMessages={() => router.push("/guest/messages")}
              error={t.error}
              errorLabel={copy.concierge.notSent}
              retryLabel={copy.concierge.retry}
              onRetry={t.retry ? () => retry(i) : undefined}
            />
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
          <ChipRow>
            {chips.map((c) => (
              <Chip key={c} label={c} onPress={() => send(c)} />
            ))}
          </ChipRow>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={copy.concierge.placeholder}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => send(draft)}
            style={{ paddingRight: 6 }}
            right={
              <Pressable onPress={() => send(draft)} accessibilityRole="button" accessibilityLabel={copy.concierge.send} style={[styles.send, (busy || !draft.trim()) && { opacity: 0.5 }]} disabled={busy || !draft.trim()}>
                <Icon name="chev" size={20} color={colors.night} strokeWidth={2} />
              </Pressable>
            }
          />
        </View>
      </KeyboardFill>
    </Screen>
  );
}

function Bubble({
  role,
  text,
  escalated,
  escalatedLabel,
  escalatedNote,
  onOpenMessages,
  error,
  errorLabel,
  retryLabel,
  onRetry,
}: {
  role: "user" | "assistant";
  text: string;
  escalated?: boolean;
  escalatedLabel?: string;
  escalatedNote?: string;
  onOpenMessages?: () => void;
  error?: boolean;
  errorLabel?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
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
        <View style={[styles.bot, escalated && { borderColor: "rgba(245,158,11,0.35)" }, error && { borderColor: "rgba(239,68,68,0.35)" }]}>
          <T v="body15" color={colors.ivory90}>
            {error ? text : renderInlineBold(text)}
          </T>
        </View>
        {escalated && escalatedLabel ? <Badge label={escalatedLabel} kind="amber" /> : null}
        {/* Couple replies land in Messages, not in this chat. */}
        {escalated && escalatedNote ? (
          <Pressable onPress={onOpenMessages} accessibilityRole="link" hitSlop={8}>
            <T v="meta13" color={colors.goldLight} style={{ textDecorationLine: "underline" }}>
              {escalatedNote}
            </T>
          </Pressable>
        ) : null}
        {error ? (
          <Row gap={8}>
            {errorLabel ? <Badge label={errorLabel} kind="red" /> : null}
            {onRetry && retryLabel ? <Chip label={retryLabel} onPress={onRetry} /> : null}
          </Row>
        ) : null}
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  bot: { maxWidth: 290, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, paddingHorizontal: 14, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  me: { maxWidth: 270, borderRadius: 18, borderBottomRightRadius: 4, padding: 12, paddingHorizontal: 14, backgroundColor: colors.gold },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
});
