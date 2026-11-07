// The Coordinator chat, in the app. Couples talk to the AI Coordinator,
// planners to the planner assistant; both stream over the same event
// protocol as the web page. Reads and proposals only: an action card does
// nothing until Confirm, and broadcasts need the typed word.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure, del } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Row, Stack, Avatar, Badge, Button, Card, Chip, ChipRow, IconButton, Icon, Input, ListRow, Sheet, Skeleton, EmptyState, SectionLabel, Hairline, ChatList, ChatComposer, toast, useKeyboardOpen, renderInlineBold, TwoPane, useLayout, useSideInsetsStyle } from "@/ui";
import { PaneEmbed } from "@/ui/MasterDetail";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/assistant/copy";
import { streamPost, type ActionCard, type StreamEvent, type StreamOutcome } from "@/features/assistant/stream";
import { coordinatorBase, useAssistantSession, useAssistantSessions, type AssistantSurface, type TimelineItem } from "@/features/assistant/hooks";
import { useSafeBack } from "@/lib/nav";
import { useAiConsentGate } from "@/features/aiconsent/ConsentGate";
import { CoordinatorShowcase } from "./Showcase";
import { PlanCard } from "./PlanCard";
import { lineUndone, readPlan, type PlanStep } from "./plan";
import { PLAN_COPY } from "./planCopy";

/** `tab`: the couple's Coordinator tab (no back control, the tab bar is on
 *  screen). Without it this is the pushed /assistant screen the planner uses. */
export function AssistantView({ tab = false }: { tab?: boolean }) {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const { twoPane } = useLayout();
  const sideInsets = useSideInsetsStyle();
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
  // #5 plan card: the line whose Undo is in flight.
  const [undoBusy, setUndoBusy] = useState<string | null>(null);
  // Apple 5.1.2(i): nothing reaches the AI provider before this person allows it.
  const consent = useAiConsentGate();

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

  // A couple whose Coordinator is off sees what it can do (Showcase); the
  // planner assistant keeps the plain note.
  const showcase = !enabled && surface === "couple";
  // The tab waits for the answer instead of flashing the chat of a wedding
  // that has none.
  const waiting = tab && surface === "couple" && !sessionsQ.data && sessionsQ.isLoading;
  const notEnabledText = enabled || showcase ? null : copy.notEnabledBody;

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
          // An executed card changed the wedding (a guest, an RSVP, a
          // reminder, the brain): everything else on screen refetches.
          void qc.invalidateQueries({ predicate: (q) => !String(q.queryKey[0] ?? "").startsWith("assistant") });
          setNow(Date.now());
          setItems((prev) => prev.map((it) => (it.kind === "card" && it.card.id === event.card.id ? { kind: "card", card: event.card } : it)));
          break;
        case "card_status":
        case "plan_step":
          setNow(Date.now());
          setItems((prev) => prev.map((it) => (it.kind === "card" && it.card.id === event.card.id ? { kind: "card", card: event.card } : it)));
          break;
        default:
          break;
      }
    },
    [adoptSession, qc]
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
    if (!(await consent.ask("coordinator"))) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setDraft("");
    setBusy(true);
    setItems((prev) => [
      // A new message closes the open cards; the server marks a plan "replaced", never "discarded".
      ...prev.map((it) =>
        it.kind === "card" && it.card.status === "proposed"
          ? { kind: "card" as const, card: { ...it.card, status: "cancelled", ...(readPlan(it.card) ? { plan: { ...(it.card.plan as object), replaced: true } } : {}) } }
          : it
      ),
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
    if (!(await consent.ask("coordinator"))) return;
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

  /** #5: run the ticked lines of a plan, or (no list) try again what failed or was not reached. */
  async function runPlan(card: ActionCard, keepStepIds?: string[]) {
    if (busy || cardBusy || undoBusy) return;
    if (!(await consent.ask("coordinator"))) return;
    setCardBusy(card.id);
    setCardError((p) => ({ ...p, [card.id]: "" }));
    const outcome = await run({ sessionId: sessionIdRef.current, confirmActionId: card.id, ...(keepStepIds ? { keepStepIds } : {}) }, applyEvent);
    setCardBusy(null);
    void qc.invalidateQueries({ predicate: (q) => !String(q.queryKey[0] ?? "").startsWith("assistant") });
    if (!outcome.ok) setCardError((p) => ({ ...p, [card.id]: outcome.error?.[lang] ?? PLAN_COPY[lang].runFailed }));
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /** #5: Undo one line a plan created; the toast names what was removed. */
  async function undoPlanStep(card: ActionCard, step: PlanStep) {
    if (busy || cardBusy || undoBusy) return;
    setUndoBusy(step.id);
    setCardError((p) => ({ ...p, [card.id]: "" }));
    let undone = false;
    const outcome = await run({ sessionId: sessionIdRef.current, undoActionId: card.id, undoStepId: step.id }, (e) => {
      if ((e.t === "card_status" || e.t === "plan_step") && e.card.id === card.id && lineUndone(e.card, step.id)) undone = true;
      applyEvent(e);
    });
    setUndoBusy(null);
    if (undone) {
      void qc.invalidateQueries({ predicate: (q) => !String(q.queryKey[0] ?? "").startsWith("assistant") });
      toast(PLAN_COPY[lang].undone[step.area]);
    } else setCardError((p) => ({ ...p, [card.id]: outcome.error?.[lang] ?? PLAN_COPY[lang].undoFailed }));
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
  // The intro and the quick questions fold away while typing, so the last
  // message keeps the room above the composer (M6, K5).
  const typing = useKeyboardOpen();
  const showEmpty = !busy && items.length === 0 && (!sessionId || detailQ.isFetched);

  const historyRows = (
    <>
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
    </>
  );

  const chat = (
    <Screen
      // The pushed /assistant (planner) is a native modal: its toasts (an Undo
      // result, the consent notice) need the modal's own host.
      modal={!tab}
      scroll={false}
      padded={false}
      keyboard="chat"
      header={
        <TopBar
          onBack={tab ? undefined : back}
          title={copy.title}
          right={
            showcase ? undefined : (
              <Row gap={8}>
                <IconButton name="plus" onPress={newChat} label={copy.newChat} />
                {twoPane ? null : <IconButton name="list" onPress={() => setDrawer(true)} label={copy.chats} />}
              </Row>
            )
          }
        />
      }
    >
      {typing || showcase || waiting ? null : (
        <>
          {/* The intro block sits above a hairline, and the message list is
              clipped under that line, so messages never run into the
              sentence (D-017). */}
          <Row gap={12} align="flex-start" style={{ paddingHorizontal: 24, marginTop: 4, paddingBottom: 12 }}>
            <Avatar gem size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="meta13" color={colors.ivory70}>
                {surface === "planner" ? copy.subtitlePlanner : copy.subtitleCouple}
              </T>
              <T v="meta13" color={colors.ivory55}>
                {copy.aiNotice}
              </T>
            </View>
          </Row>
          <Hairline />
        </>
      )}

      {waiting ? (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 10 }}>
          <Skeleton h={48} r={18} />
          <Skeleton h={120} r={18} />
        </View>
      ) : showcase ? (
        <CoordinatorShowcase />
      ) : notEnabledText ? (
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
          <ChatList contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 }}>
            {sessionId && !detailQ.data && detailQ.isLoading ? (
              <Stack gap={10}>
                <Skeleton h={48} r={18} />
                <Skeleton h={72} r={18} w="80%" />
              </Stack>
            ) : null}
            {showEmpty ? <EmptyState title={copy.emptyTitle} body={surface === "planner" ? copy.emptyBodyPlanner : copy.emptyBody} /> : null}
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
                undoBusy={undoBusy}
                onRunPlan={runPlan}
                onUndoPlan={undoPlanStep}
                onAskAgain={(text) => void send(text)}
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
          </ChatList>
          {canSend ? (
            <ChatComposer
              value={draft}
              onChangeText={setDraft}
              onSend={() => void send(draft)}
              placeholder={copy.placeholder}
              sendLabel={copy.send}
              busy={busy}
              testID="assistant-input"
              sendTestID="assistant-send"
              accessory={
                items.length === 0 && !busy && !typing ? (
                  <ChipRow>
                    {chips.map((c) => (
                      <Chip key={c} label={c} onPress={() => void send(c)} />
                    ))}
                  </ChipRow>
                ) : null
              }
            />
          ) : (
            <ChatComposer>
              <T v="meta13" color={colors.ivory55} center style={{ paddingVertical: 10 }}>
                {copy.readOnly}
              </T>
            </ChatComposer>
          )}
        </>
      )}

      {consent.sheet}
      <Sheet visible={drawer} onClose={() => setDrawer(false)} top={140} scroll={false}>
        <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <T v="title26">{copy.chats}</T>
          <Button label={copy.newChat} small kind="glass" full={false} icon="plus" onPress={newChat} />
        </Row>
        <Hairline />
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {historyRows}
        </ScrollView>
      </Sheet>
    </Screen>
  );

  // Wide windows (the Duo's inner display, the outer display sideways): the chat
  // history sits beside the conversation instead of in a drawer.
  if (twoPane && !showcase && !waiting) {
    return (
      <PaneEmbed>
        <View style={[{ flex: 1 }, sideInsets]}>
          <TwoPane
            list={
              <Screen scroll padded={false} header={<TopBar title={copy.chats} right={<IconButton name="plus" onPress={newChat} label={copy.newChat} />} />}>
                {historyRows}
              </Screen>
            }
            detail={chat}
          />
        </View>
      </PaneEmbed>
    );
  }
  return chat;
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
  undoBusy,
  onRunPlan,
  onUndoPlan,
  onAskAgain,
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
  undoBusy: string | null;
  onRunPlan: (card: ActionCard, keepStepIds?: string[]) => void;
  onUndoPlan: (card: ActionCard, step: PlanStep) => void;
  onAskAgain: (text: string) => void;
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
            {renderInlineBold(item.text)}
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
  // #5: a plan card the app can read (1.4.0, MW_PLAN_CARD); anything else is drawn as before.
  const plan = readPlan(card);
  if (plan) {
    return (
      <PlanCard
        // A new key when the server's card moves on (ran, closed), so the ticks start from its lines again.
        key={`${card.id}:${card.status}:${plan.ran}`}
        card={card}
        plan={plan}
        lang={lang}
        canEdit={canSend}
        busy={cardBusy === card.id}
        locked={!!cardBusy && cardBusy !== card.id}
        undoBusy={undoBusy}
        error={cardError[card.id] || undefined}
        onRun={(keep) => onRunPlan(card, keep)}
        onRetry={() => onRunPlan(card)}
        onDiscard={() => onCancel(card)}
        onUndo={(step) => onUndoPlan(card, step)}
        onAskAgain={onAskAgain}
      />
    );
  }
  const proposed = card.status === "proposed";
  const expired = proposed && card.expiresAtMs > 0 && now > card.expiresAtMs;
  const statusLabel =
    card.status === "executed" ? copy.statusExecuted : card.status === "cancelled" ? copy.statusCancelled : card.status === "failed" ? copy.statusFailed : expired ? copy.statusExpired : copy.statusProposed;
  const statusKind = card.status === "executed" ? "green" : card.status === "failed" ? "red" : proposed && !expired ? "gold" : "mute";
  const err = cardError[card.id];
  return (
    <View style={{ paddingLeft: 38 }}>
      <Card kind="glass" padding={16} border={proposed && !expired ? colors.goldBorder : undefined}>
        {/* Badge above the title: side by side, the long status label left the
            title one letter wide (Oct 31 2026). */}
        <Stack gap={8} style={{ alignItems: "flex-start" }}>
          <Badge label={statusLabel} kind={statusKind} />
          <T v="name24">{card.title[lang]}</T>
        </Stack>
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
              <Input accessibilityLabel={copy.typedHint} value={typed[card.id] ?? ""} onChangeText={(t) => setTyped((p) => ({ ...p, [card.id]: t }))} placeholder={copy.typedPlaceholder} autoCapitalize="characters" autoCorrect={false} />
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
  quote: { borderLeftWidth: 2, borderLeftColor: colors.goldBorder, paddingLeft: 10, gap: 4 },
});
