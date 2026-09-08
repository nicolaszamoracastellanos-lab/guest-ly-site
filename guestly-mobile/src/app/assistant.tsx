// The Coordinator chat, in the app. Couples talk to the AI Coordinator,
// planners to the planner assistant; both stream over the same event
// protocol as the web page. Reads and proposals only: an action card does
// nothing until Confirm, and broadcasts need the typed word.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure, del } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Row, Stack, Avatar, Badge, Button, Card, Chip, ChipRow, IconButton, Icon, Input, ListRow, Sheet, Skeleton, EmptyState, SectionLabel, Hairline } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/assistant/copy";
import { streamPost, type ActionCard, type StreamEvent, type StreamOutcome } from "@/features/assistant/stream";
import { coordinatorBase, useAssistantSession, useAssistantSessions, type AssistantSurface, type TimelineItem } from "@/features/assistant/hooks";

export default function AssistantScreen() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const user = useUserSession();
  const surface: AssistantSurface = user?.me.surface === "planner" ? "planner" : "couple";
  const canSend = surface === "planner" ? true : (user?.me.can_edit ?? false);
  const base = coordinatorBase(surface);

  const sessionsQ = useAssistantSessions(surface);
  const enabled = sessionsQ.data?.enabled ?? true;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pickedFirst, setPickedFirst] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const detailQ = useAssistantSession(surface, sessionId);

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [cardBusy, setCardBusy] = useState<string | null>(null);
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  // Card expiry is judged against the clock at the last change, not per render.
  const [now, setNow] = useState(() => Date.now());

  // Open the newest chat once the list arrives; "New chat" clears it.
  // State adjusted during render, guarded by pickedFirst.
  if (!pickedFirst && sessionsQ.data) {
    setPickedFirst(true);
    setSessionId(sessionsQ.data.sessions[0]?.id ?? null);
  }
  // Adopt the server history when a chat is opened from the drawer.
  if (detailQ.data && sessionId && loadedFor !== sessionId && !busy) {
    setLoadedFor(sessionId);
    setItems(detailQ.data.items);
  }
  // The ref mirrors the state for stream handlers that fire before a re-render.
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [items, busy]);

  const notEnabledText = useMemo(() => {
    if (enabled) return null;
    return lang === "es"
      ? "El Coordinador no está activado para esta boda. Escríbanos a hello@guest-ly.com y lo activaremos."
      : "The Coordinator is not switched on for this wedding. Write to hello@guest-ly.com and we will enable it.";
  }, [enabled, lang]);

  const adoptSession = useCallback(
    (id: string) => {
      if (sessionIdRef.current === id) return;
      sessionIdRef.current = id;
      setSessionId(id);
      setLoadedFor(id);
      void qc.invalidateQueries({ queryKey: ["assistant-sessions", surface] });
    },
    [qc, surface]
  );

  const applyEvent = useCallback(
    (event: StreamEvent) => {
      switch (event.t) {
        case "session":
          adoptSession(event.sessionId);
          break;
        case "tool":
          setItems((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.kind === "tools") return [...prev.slice(0, -1), { kind: "tools", names: [...last.names, event.name] }];
            return [...prev, { kind: "tools", names: [event.name] }];
          });
          break;
        case "reply":
          setItems((prev) => [...prev, { kind: "coordinator", text: event.text }]);
          break;
        case "card":
          setNow(Date.now());
          setItems((prev) => [...prev, { kind: "card", card: event.card }]);
          break;
        case "executed":
        case "card_status":
          setNow(Date.now());
          setItems((prev) => prev.map((it) => (it.kind === "card" && it.card.id === event.card.id ? { kind: "card", card: event.card } : it)));
          break;
        default:
          break;
      }
    },
    [adoptSession]
  );

  async function run(body: Parameters<typeof streamPost>[1], on: (e: StreamEvent) => void): Promise<StreamOutcome> {
    try {
      return await streamPost(base, body, on, { lang });
    } catch (err) {
      if (err instanceof ApiFailure) {
        if (err.code === "not_enabled") void qc.invalidateQueries({ queryKey: ["assistant-sessions", surface] });
        return { ok: false, error: err.messages, code: err.code };
      }
      return { ok: false, error: { en: copy.error, es: copy.error } };
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !canSend) return;
    if (!online) {
      setError(copy.offline);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setDraft("");
    setBusy(true);
    setItems((prev) => [
      ...prev.map((it) => (it.kind === "card" && it.card.status === "proposed" ? { kind: "card" as const, card: { ...it.card, status: "cancelled" } } : it)),
      { kind: "user", text: message },
    ]);
    let outcome = await run({ sessionId: sessionIdRef.current, message }, applyEvent);
    while (outcome.ok && outcome.continueTurn) {
      outcome = await run({ sessionId: sessionIdRef.current, continueTurn: true, turn: outcome.continueTurn }, applyEvent);
    }
    setBusy(false);
    if (!outcome.ok) setError(outcome.error?.[lang] ?? copy.error);
    void qc.invalidateQueries({ queryKey: ["assistant-session", surface, sessionIdRef.current] });
  }

  async function confirm(card: ActionCard) {
    if (busy || cardBusy) return;
    setCardBusy(card.id);
    setCardError((p) => ({ ...p, [card.id]: "" }));
    let executed = false;
    const outcome = await run({ sessionId: sessionIdRef.current, confirmActionId: card.id, confirmText: typed[card.id] ?? "" }, (e) => {
      if (e.t === "executed" && e.card.id === card.id) executed = true;
      applyEvent(e);
    });
    setCardBusy(null);
    if (outcome.code === "typed_confirm_required") {
      setCardError((p) => ({ ...p, [card.id]: copy.typedHint }));
      return;
    }
    if (!outcome.ok && outcome.error && !executed) setCardError((p) => ({ ...p, [card.id]: outcome.error![lang] }));
    if (executed) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function cancel(card: ActionCard) {
    if (busy || cardBusy) return;
    setCardBusy(card.id);
    await run({ sessionId: sessionIdRef.current, cancelActionId: card.id }, applyEvent);
    setCardBusy(null);
  }

  function newChat() {
    sessionIdRef.current = null;
    setSessionId(null);
    setLoadedFor(null);
    setItems([]);
    setError(null);
    setDrawer(false);
  }

  function openChat(id: string) {
    sessionIdRef.current = id;
    setSessionId(id);
    setLoadedFor(null);
    setItems([]);
    setError(null);
    setDrawer(false);
  }

  function removeChat(id: string) {
    Alert.alert(copy.delete, copy.deleteConfirm, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.delete,
        style: "destructive",
        onPress: async () => {
          setDeleting(id);
          try {
            await del(`${base}/sessions/${id}`);
            await qc.invalidateQueries({ queryKey: ["assistant-sessions", surface] });
            if (id === sessionIdRef.current) newChat();
          } catch (err) {
            setError(err instanceof ApiFailure ? err.messages[lang] : copy.error);
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  }

  const chips = surface === "planner" ? copy.chipsPlanner : copy.chips;
  const bottomPad = Math.max(insets.bottom, 12) + 8;
  const showEmpty = !busy && items.length === 0 && (!sessionId || detailQ.isFetched);

  return (
    <Screen
      scroll={false}
      padded={false}
      bottomInset={0}
      header={
        <TopBar
          onBack={() => router.back()}
          title={copy.title}
          right={
            <Row gap={8}>
              <IconButton name="plus" onPress={newChat} label={copy.newChat} />
              <IconButton name="list" onPress={() => setDrawer(true)} label={copy.chats} />
            </Row>
          }
        />
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <Row gap={12} style={{ paddingHorizontal: 24, marginTop: 8 }}>
          <Avatar gem size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title26">{copy.title}</T>
            <T v="meta13" color={colors.ivory55}>
              {surface === "planner" ? copy.subtitlePlanner : copy.subtitleCouple}
            </T>
          </View>
        </Row>

        {notEnabledText ? (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <Card kind="solid" padding={18}>
              <SectionLabel color={colors.goldLight}>{copy.notEnabledTitle}</SectionLabel>
              <T v="body16" style={{ marginTop: 8 }}>
                {notEnabledText}
              </T>
            </Card>
          </View>
        ) : (
          <>
            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
              {sessionId && !detailQ.data && detailQ.isLoading ? (
                <Stack gap={10}>
                  <Skeleton h={48} r={18} />
                  <Skeleton h={72} r={18} w="80%" />
                </Stack>
              ) : null}
              {showEmpty ? (
                <EmptyState title={copy.emptyTitle} body={surface === "planner" ? copy.emptyBodyPlanner : copy.emptyBody} />
              ) : null}
              {items.map((it, i) => (
                <Item
                  key={i}
                  item={it}
                  lang={lang}
                  copy={copy}
                  now={now}
                  typed={typed}
                  setTyped={setTyped}
                  cardBusy={cardBusy}
                  cardError={cardError}
                  canSend={canSend}
                  onConfirm={confirm}
                  onCancel={cancel}
                />
              ))}
              {busy ? (
                <Row gap={10}>
                  <Avatar gem size={28} />
                  <View style={[styles.bot, { flexDirection: "row", gap: 8, alignItems: "center" }]}>
                    <ActivityIndicator color={colors.goldLight} size="small" />
                    <T v="meta13" color={colors.ivory55}>
                      {copy.working}
                    </T>
                  </View>
                </Row>
              ) : null}
              {error ? (
                <T v="body15" color={colors.red}>
                  {error}
                </T>
              ) : null}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingBottom: bottomPad, gap: 8 }}>
              {items.length === 0 && !busy ? (
                <ChipRow>
                  {chips.map((c) => (
                    <Chip key={c} label={c} onPress={() => send(c)} />
                  ))}
                </ChipRow>
              ) : null}
              {canSend ? (
                <Input
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={copy.placeholder}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={() => send(draft)}
                  editable={!busy}
                  style={{ paddingRight: 6 }}
                  right={
                    <Pressable onPress={() => send(draft)} accessibilityRole="button" accessibilityLabel={copy.send} style={[styles.send, (busy || !draft.trim()) && { opacity: 0.5 }]} disabled={busy || !draft.trim()}>
                      <Icon name="chev" size={20} color={colors.night} strokeWidth={2} />
                    </Pressable>
                  }
                />
              ) : (
                <T v="meta13" color={colors.ivory55} center>
                  {copy.readOnly}
                </T>
              )}
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <Sheet visible={drawer} onClose={() => setDrawer(false)} top={140}>
        <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <T v="title26">{copy.chats}</T>
          <Button label={copy.newChat} small kind="glass" full={false} icon="plus" onPress={newChat} />
        </Row>
        <Hairline />
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {sessionsQ.data && sessionsQ.data.sessions.length === 0 ? (
            <T v="body15" color={colors.ivory55} style={{ paddingVertical: 16 }}>
              {copy.noChats}
            </T>
          ) : null}
          {(sessionsQ.data?.sessions ?? []).map((s, i, arr) => (
            <ListRow
              key={s.id}
              leading={<Icon name="chat" size={20} color={s.id === sessionId ? colors.goldLight : colors.ivory55} />}
              title={s.title ?? copy.untitled}
              sub={relTime(s.last_active_at, lang)}
              onPress={() => openChat(s.id)}
              chevron={false}
              trailing={
                deleting === s.id ? (
                  <ActivityIndicator color={colors.goldLight} size="small" />
                ) : canSend ? (
                  <IconButton name="x" onPress={() => removeChat(s.id)} label={copy.delete} />
                ) : undefined
              }
              last={i === arr.length - 1}
            />
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

type Copy = (typeof COPY)["en"];

function Item({
  item,
  lang,
  copy,
  now,
  typed,
  setTyped,
  cardBusy,
  cardError,
  canSend,
  onConfirm,
  onCancel,
}: {
  item: TimelineItem;
  lang: "en" | "es";
  copy: Copy;
  now: number;
  typed: Record<string, string>;
  setTyped: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  cardBusy: string | null;
  cardError: Record<string, string>;
  canSend: boolean;
  onConfirm: (card: ActionCard) => void;
  onCancel: (card: ActionCard) => void;
}) {
  if (item.kind === "user") {
    return (
      <View style={{ alignItems: "flex-end" }}>
        <View style={styles.me}>
          <T v="body15" color={colors.night}>
            {item.text}
          </T>
        </View>
      </View>
    );
  }
  if (item.kind === "coordinator") {
    return (
      <Row gap={10} align="flex-end">
        <Avatar gem size={28} />
        <View style={[styles.bot, { flex: 1 }]}>
          <T v="body15" color={colors.ivory90}>
            {item.text}
          </T>
        </View>
      </Row>
    );
  }
  if (item.kind === "tools") {
    return (
      <View style={{ paddingLeft: 38, gap: 2 }}>
        {item.names.map((n, i) => (
          <T key={`${n}${i}`} v="meta13" color={colors.ivory40}>
            {copy.tools[n] ?? n}
          </T>
        ))}
      </View>
    );
  }
  const card = item.card;
  const proposed = card.status === "proposed";
  const expired = proposed && card.expiresAtMs > 0 && now > card.expiresAtMs;
  const statusLabel =
    card.status === "executed" ? copy.statusExecuted : card.status === "cancelled" ? copy.statusCancelled : card.status === "failed" ? copy.statusFailed : expired ? copy.statusExpired : copy.statusProposed;
  const statusKind = card.status === "executed" ? "green" : card.status === "failed" ? "red" : proposed && !expired ? "gold" : "mute";
  const err = cardError[card.id];
  return (
    <View style={{ paddingLeft: 38 }}>
      <Card kind="glass" padding={16} border={proposed && !expired ? colors.goldBorder : undefined}>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <T v="name24" style={{ flex: 1 }}>
            {card.title[lang]}
          </T>
          <Badge label={statusLabel} kind={statusKind} />
        </Row>
        <Stack gap={8} style={{ marginTop: 10 }}>
          {card.fields.map((f, i) => (
            <View key={i}>
              <SectionLabel>{f.label[lang]}</SectionLabel>
              {f.before ? (
                <T v="meta13" color={colors.ivory40}>
                  {copy.before}: {f.before}
                </T>
              ) : null}
              <T v="body15">{typeof f.after === "string" ? f.after : f.after[lang]}</T>
            </View>
          ))}
          {card.messageTexts?.map((m) => (
            <View key={m.lang} style={styles.quote}>
              <SectionLabel color={colors.goldLight}>{m.lang.toUpperCase()}</SectionLabel>
              <T v="body15" color={colors.ivory90}>
                {m.text}
              </T>
            </View>
          ))}
          {typeof card.recipientCount === "number" ? (
            <T v="meta13" color={colors.ivory55}>
              {fmt(copy.recipients, { n: card.recipientCount })}
            </T>
          ) : null}
          {card.warning ? (
            <T v="meta13" color={colors.amber}>
              {card.warning[lang]}
            </T>
          ) : null}
        </Stack>
        {proposed && !expired ? (
          <Stack gap={8} style={{ marginTop: 14 }}>
            {card.requiresTypedConfirm ? (
              <Input value={typed[card.id] ?? ""} onChangeText={(t) => setTyped((p) => ({ ...p, [card.id]: t }))} placeholder={copy.typedPlaceholder} autoCapitalize="characters" autoCorrect={false} />
            ) : null}
            {err ? (
              <T v="meta13" color={colors.red}>
                {err}
              </T>
            ) : null}
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Button label={copy.confirm} small onPress={() => onConfirm(card)} loading={cardBusy === card.id} disabled={!canSend || (!!cardBusy && cardBusy !== card.id)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={copy.cancelCard} small kind="glass" onPress={() => onCancel(card)} disabled={!canSend || !!cardBusy} />
              </View>
            </Row>
          </Stack>
        ) : err ? (
          <T v="meta13" color={colors.red} style={{ marginTop: 8 }}>
            {err}
          </T>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  bot: { maxWidth: 300, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, paddingHorizontal: 14, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  me: { maxWidth: 280, borderRadius: 18, borderBottomRightRadius: 4, padding: 12, paddingHorizontal: 14, backgroundColor: colors.gold },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.goldBorder, paddingLeft: 10, gap: 4 },
});
