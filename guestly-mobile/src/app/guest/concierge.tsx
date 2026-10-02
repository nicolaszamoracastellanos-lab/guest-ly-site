// Ask (build 12, prototype M6): one thread for everything the guest asks.
//
// The concierge's answers and the couple's replies ("From Camila & Andrés",
// gold border) in one conversation. It replaces the Concierge tab, the
// read-only Messages screen and the bells (N7, N16). The thread is the
// guest's app thread on the portal (/guest/messages): the portal stores each
// question and answer there, and the couple answers into it. What was just
// sent shows at once and gives way to the stored copy when it arrives.
// Without the server thread (offline, an older portal) the chat kept on this
// phone is shown, as in build 11.
//
// Keyboard (Foundation chat kit): the composer rides the keyboard frame by
// frame, the newest message stays above it, the box grows to 5 lines, the
// keyboard stays up after sending; the title shrinks to one line and the
// quick questions step aside while typing (K3, K4, K15). The AI notice is one
// line with an info icon (D9, guest AI disclosure).
// No "Ask the couple directly" button: that endpoint is deferred.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { api, get } from "@/lib/api";
import { useGuestMessages, type ThreadMessage } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Chip, Row, Icon, Badge, ChipRow, Sheet, Card, Button, ChatList, ChatComposer, useKeyboardOpen, renderInlineBold, useTopInset, type ChatListHandle } from "@/ui";
import { colors, fonts } from "@/ui/tokens";
import { guestErrorText } from "@/features/guest/errors";
import { useRefetchOnRefocus } from "@/features/guest/focus";
import { GUEST_COPY } from "@/features/guest/copy";
import { useAskSeen } from "@/features/guest/state";

// `error` turns are local only: never sent back to the engine as history,
// never saved. `retry` is the question to send again. `at` is when it was
// sent here, to match it with the stored copy.
type Turn = { role: "user" | "assistant"; content: string; escalated?: boolean; error?: boolean; retry?: string; at?: number; key?: string; done?: boolean };
// Keys carry the wedding and the guest, so two guests on one phone never see
// each other's chat. The "gl.concierge." prefix is cleared on sign out.
const LEGACY_KEYS = ["gl.concierge.draft", "gl.concierge.history"];
const EPOCH = "1970-01-01T00:00:00.000Z";

type Item =
  | { kind: "server"; m: ThreadMessage }
  | { kind: "local"; t: Turn; index: number };

export default function Ask() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const session = useGuestSession();
  const qc = useQueryClient();
  const top = useTopInset();
  const focused = useIsFocused();
  const typing = useKeyboardOpen();
  const mainQuery = useGuestMessages({ poll: focused });
  useRefetchOnRefocus(focused, mainQuery.refetch);
  const { data } = mainQuery;
  const scope = session ? `guest:${session.tenant.slug}:${session.guest.id}` : "none";
  const draftKey = `gl.concierge.draft:${scope}`;
  const historyKey = `gl.concierge.history:${scope}`;
  // Saved chat (fallback when the server thread is not there) and this
  // visit's sends that the server copy has not replaced yet.
  const [saved, setSaved] = useState<Turn[]>([]);
  const [live, setLive] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === historyKey;
  const [sessionId] = useState(() => `app-${Math.random().toString(36).slice(2, 10)}`);
  const list = useRef<ChatListHandle>(null);
  const name = session?.guest.name.split(" ")[0] ?? "";
  const couple = session?.tenant.couple_names ?? "";
  const keySeq = useRef(0);

  // ---- saved chat and draft (unchanged storage from build 11)
  useEffect(() => {
    let cancelled = false;
    setSaved([]);
    setLive([]);
    setDraft("");
    AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
    AsyncStorage.multiGet([draftKey, historyKey])
      .then(([[, d], [, h]]) => {
        if (cancelled) return;
        if (d) setDraft(d);
        if (h) {
          try {
            const s = JSON.parse(h) as Turn[];
            if (Array.isArray(s)) setSaved(s.filter((t) => t && !t.error && typeof t.content === "string"));
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
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(draftKey, draft).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [draft, draftKey, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(historyKey, JSON.stringify(saved.filter((t) => !t.error).slice(-30))).catch(() => {});
  }, [saved, historyKey, loaded]);

  // ---- the server thread, with older pages fetched on demand
  const [older, setOlder] = useState<ThreadMessage[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  useEffect(() => {
    setOlder([]);
    setOlderHasMore(null);
  }, [scope]);
  const server = useMemo(() => {
    const byId = new Map<string, ThreadMessage>();
    for (const m of [...older, ...(data?.messages ?? [])]) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }, [older, data?.messages]);
  // The thread is the source once it holds the concierge's own answers. The
  // production thread exists for every guest (the portal opens one on the
  // first read) but does not store concierge Q&A yet: until it does, the chat
  // saved on this phone stays on screen, with the couple's replies from the
  // thread merged in by time (review fix, build 12).
  const serverReady = !!data && !data.pending;
  const useServer = serverReady && server.some((m) => m.role === "bot");
  const hasMore = olderHasMore ?? (data as { has_more?: boolean } | undefined)?.has_more ?? false;
  const loadOlder = useCallback(async () => {
    const oldest = server[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const r = await get<{ messages: ThreadMessage[]; has_more?: boolean }>(`/guest/messages?before=${encodeURIComponent(oldest.created_at)}`);
      setOlder((prev) => [...r.messages, ...prev]);
      setOlderHasMore(!!r.has_more && r.messages.length > 0);
    } catch {
      // A second tap retries.
    } finally {
      setLoadingOlder(false);
    }
  }, [server, loadingOlder]);

  // A sent turn gives way to its stored copy: same author, same text, stored
  // after it was sent here (two minutes of clock slack).
  const stored = useCallback(
    (t: Turn) =>
      !t.error &&
      server.some((m) => (m.role === "guest") === (t.role === "user") && m.role !== "couple" && m.text.trim() === t.content.trim() && Date.parse(m.created_at) >= (t.at ?? 0) - 120_000),
    [server]
  );
  useEffect(() => {
    if (!useServer) return;
    setLive((all) => (all.some(stored) ? all.filter((t) => !stored(t)) : all));
  }, [useServer, stored]);

  // ---- unread: what the guest had seen when the tab opened, then mark seen
  const { seen, markSeen } = useAskSeen();
  const newestCouple = useMemo(() => server.reduce<string | null>((acc, m) => (m.role === "couple" && (!acc || Date.parse(m.created_at) > Date.parse(acc)) ? m.created_at : acc), null), [server]);
  const [seenAtOpen, setSeenAtOpen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!focused) {
      setSeenAtOpen(undefined);
      return;
    }
    if (seen === undefined || !data) return;
    setSeenAtOpen((cur) => (cur === undefined ? seen ?? EPOCH : cur));
    // The mark also says "this guest uses Ask", which lets the tab bar check
    // for replies (see guest/_layout).
    markSeen(newestCouple ?? EPOCH);
  }, [focused, seen, data, newestCouple, markSeen]);
  const firstNew = useMemo(() => {
    if (!seenAtOpen) return null;
    const m = server.find((x) => x.role === "couple" && Date.parse(x.created_at) > Date.parse(seenAtOpen));
    return m?.id ?? null;
  }, [server, seenAtOpen]);

  // ---- what is on screen
  const items: Item[] = useMemo(() => {
    let out: Item[];
    if (useServer) out = server.map((m) => ({ kind: "server" as const, m }));
    else {
      // Saved turns from before build 12 have no time: they stay first, in order.
      const timed = [
        ...saved.map((t, i) => ({ at: t.at ?? 0, order: i, item: { kind: "local" as const, t, index: -1 - i } as Item })),
        ...(serverReady ? server.filter((m) => m.role === "couple") : []).map((m, i) => ({ at: Date.parse(m.created_at) || 0, order: saved.length + i, item: { kind: "server" as const, m } as Item })),
      ];
      timed.sort((a, b) => a.at - b.at || a.order - b.order);
      out = timed.map((x) => x.item);
    }
    // Without the server thread, answered turns are already in the saved chat.
    live.forEach((t, i) => {
      if (useServer || !t.done) out.push({ kind: "local", t, index: i });
    });
    return out;
  }, [useServer, serverReady, server, saved, live]);

  const send = useCallback(
    async (text: string, retrying = false) => {
      const msg = text.trim();
      if (!msg || busy) return;
      if (!retrying) setDraft("");
      // History for the engine: the conversation so far, without failed
      // exchanges and without the couple's lines.
      const history = items
        .map((it) => (it.kind === "server" ? (it.m.role === "couple" ? null : { role: it.m.role === "guest" ? ("user" as const) : ("assistant" as const), content: it.m.text }) : it.t.error ? null : { role: it.t.role, content: it.t.content }))
        .filter((x): x is { role: "user" | "assistant"; content: string } => !!x)
        .slice(-12);
      const at = Date.now();
      const q: Turn = { role: "user", content: msg, at, key: `l${++keySeq.current}` };
      setLive((t) => (retrying ? t : [...t, q]));
      setBusy(true);
      try {
        // A real reply calls the AI engine, which can run well past the API
        // client's 20 s default (D-044).
        const r = await api<{ reply: string; escalated: boolean }>("/guest/concierge", {
          method: "POST",
          body: { message: msg, session_id: sessionId, history },
          timeoutMs: 120_000,
        });
        const a: Turn = { role: "assistant", content: r.reply, escalated: r.escalated, at, key: `l${++keySeq.current}`, done: true };
        setLive((t) => [...t.map((x) => (x.key === q.key || (retrying && x.role === "user" && !x.done && x.content.trim() === msg) ? { ...x, done: true } : x)), a]);
        setSaved((s) => [...s, { role: "user", content: msg, at }, { role: "assistant", content: r.reply, escalated: r.escalated, at: Date.now() }]);
        // The portal stored both lines in the guest's thread.
        void qc.invalidateQueries({ queryKey: ["guest-messages"] });
      } catch (err) {
        setLive((t) => [...t, { role: "assistant", content: guestErrorText(err, copy, lang), error: true, retry: msg, at, key: `l${++keySeq.current}` }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, items, sessionId, qc, copy, lang]
  );

  /** Drops the failed answer and asks the same question again. */
  const retry = useCallback(
    (index: number) => {
      const t = live[index];
      if (!t?.retry || busy) return;
      setLive((all) => all.filter((_, i) => i !== index));
      void send(t.retry, true);
    },
    [live, busy, send]
  );

  const chips = [g.ask.chips.wear, g.ask.chips.stay, g.ask.chips.time, g.ask.chips.gifts];

  const header = typing ? (
    <TopBar title={g.ask.title} />
  ) : (
    <View style={[styles.head, { paddingTop: top + 8 }]}>
      <T v="title42" size={40} accessibilityRole="header">
        {g.ask.title}
      </T>
      <Pressable testID="ask-ai-info" onPress={() => setAiOpen(true)} accessibilityRole="button" hitSlop={8} style={styles.aiRow}>
        <Icon name="info" size={16} color={colors.goldLight} />
        <T v="meta13" size={13} color={colors.ivory70} numberOfLines={1} style={{ flexShrink: 1 }}>
          {g.ask.aiNotice}
        </T>
      </Pressable>
    </View>
  );

  return (
    <Screen scroll={false} padded={false} topInset={false} keyboard="chat" header={typing ? header : undefined}>
      {typing ? null : header}
      <ChatList ref={list} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
        {useServer && hasMore ? (
          <View style={{ alignItems: "center" }}>
            {loadingOlder ? <ActivityIndicator color={colors.goldLight} /> : <Button label={g.ask.earlier} kind="text" small full={false} onPress={() => void loadOlder()} />}
          </View>
        ) : null}
        <Bot who={g.ask.concierge} text={fmt(g.ask.hello, { name, couple })} />
        {items.map((it) => {
          if (it.kind === "server") {
            const m = it.m;
            const when = relTime(m.created_at, lang);
            if (m.role === "guest") {
              return (
                <View key={m.id} style={{ gap: 6 }}>
                  <Mine text={m.text} meta={when} />
                  {m.needs_couple && !m.replied_at ? (
                    <View style={{ alignItems: "center", gap: 6 }}>
                      <Badge label={fmt(g.ask.waiting, { couple })} kind="amber" />
                    </View>
                  ) : null}
                </View>
              );
            }
            if (m.role === "couple") {
              return (
                <View key={m.id} style={{ gap: 12 }}>
                  {m.id === firstNew ? <NewDivider label={g.ask.newLabel} /> : null}
                  <Theirs couple who={fmt(g.ask.fromCouple, { couple })} text={m.text} meta={when} />
                </View>
              );
            }
            return <Theirs key={m.id} who={g.ask.concierge} text={m.text} meta={when} />;
          }
          const t = it.t;
          const k = t.key ?? `s${it.index}`;
          if (t.role === "user") return <Mine key={k} text={t.content} />;
          if (t.error) {
            return (
              <View key={k} style={{ gap: 6, alignItems: "flex-start" }}>
                <Theirs who={g.ask.concierge} text={t.content} error />
                <Row gap={8}>
                  <Badge label={copy.concierge.notSent} kind="red" />
                  {t.retry && it.index >= 0 ? <Chip label={copy.concierge.retry} onPress={() => retry(it.index)} /> : null}
                </Row>
              </View>
            );
          }
          return (
            <View key={k} style={{ gap: 10 }}>
              <Theirs who={g.ask.concierge} text={t.content} />
              {t.escalated ? (
                <Row gap={6} style={{ alignSelf: "center", maxWidth: 320 }}>
                  <Icon name="check" size={16} color={colors.goldLight} />
                  <T v="meta13" size={13} color={colors.ivory70} center style={{ flexShrink: 1 }}>
                    {fmt(g.ask.passed, { couple })}
                  </T>
                </Row>
              ) : null}
            </View>
          );
        })}
        {busy ? (
          <View style={{ gap: 6, alignItems: "flex-start" }} accessible accessibilityLabel={copy.concierge.typing}>
            <Who label={g.ask.concierge} />
            <View style={[styles.bubble, styles.bot, { flexDirection: "row", gap: 8, alignItems: "center" }]}>
              <ActivityIndicator color={colors.goldLight} size="small" />
              <T v="meta13" color={colors.ivory70}>
                {copy.concierge.typing}
              </T>
            </View>
          </View>
        ) : null}
      </ChatList>
      <ChatComposer
        value={draft}
        onChangeText={setDraft}
        onSend={() => void send(draft)}
        placeholder={g.ask.placeholder}
        busy={busy}
        testID="ask-input"
        sendTestID="ask-send"
        accessory={
          typing ? null : (
            <View style={{ marginHorizontal: -16 }}>
              <ChipRow>
                {chips.map((c) => (
                  <Chip key={c} label={c} onPress={() => void send(c)} />
                ))}
              </ChipRow>
            </View>
          )
        }
      />
      <Sheet visible={aiOpen} onClose={() => setAiOpen(false)} top={260}>
        <T v="label11" color={colors.goldLight}>
          {g.ask.aiLabel}
        </T>
        <T v="title30" style={{ marginTop: 4 }}>
          {g.ask.aiTitle}
        </T>
        <Card kind="paper" padding={18} style={{ marginTop: 16, gap: 12 }}>
          <T v="body15" color={colors.ink}>
            {fmt(g.ask.aiBody1, { couple })}
          </T>
          <T v="body15" color={colors.ink}>
            {g.ask.aiBody2}
          </T>
        </Card>
      </Sheet>
    </Screen>
  );
}

function Who({ label, couple }: { label: string; couple?: boolean }) {
  return (
    <Row gap={8}>
      {couple ? (
        <Icon name="star" size={16} color={colors.goldLight} />
      ) : (
        <Avatar gem size={24} />
      )}
      <T v="meta13" size={13} color={couple ? colors.goldLight : colors.ivory70} style={{ fontFamily: fonts.bodyMedium }}>
        {label}
      </T>
    </Row>
  );
}

function Bot({ who, text }: { who: string; text: string }) {
  return <Theirs who={who} text={text} />;
}

function Theirs({ who, text, meta, couple, error }: { who: string; text: string; meta?: string; couple?: boolean; error?: boolean }) {
  return (
    <View style={{ gap: 6, alignItems: "flex-start", maxWidth: "86%" }} accessible accessibilityLabel={`${who}${meta ? `, ${meta}` : ""}. ${text}`}>
      <Who label={who} couple={couple} />
      <View style={[styles.bubble, styles.bot, couple && styles.couple, error && styles.error]}>
        <T v="body15" color={colors.ivory90} selectable>
          {error ? text : renderInlineBold(text)}
        </T>
      </View>
      {meta ? (
        <T v="meta13" size={13} color={colors.ivory55} style={{ paddingHorizontal: 4 }}>
          {meta}
        </T>
      ) : null}
    </View>
  );
}

function Mine({ text, meta }: { text: string; meta?: string }) {
  return (
    <View style={{ gap: 6, alignItems: "flex-end", alignSelf: "flex-end", maxWidth: "86%" }}>
      <View style={[styles.bubble, styles.me]}>
        <T v="body15" color={colors.ink} selectable>
          {text}
        </T>
      </View>
      {meta ? (
        <T v="meta13" size={13} color={colors.ivory55} style={{ paddingHorizontal: 4 }}>
          {meta}
        </T>
      ) : null}
    </View>
  );
}

function NewDivider({ label }: { label: string }) {
  return (
    <Row gap={12}>
      <View style={styles.newLine} />
      <T v="label11" color={colors.goldLight}>
        {label}
      </T>
      <View style={styles.newLine} />
    </Row>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingBottom: 8, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 },
  bubble: { borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16 },
  bot: { backgroundColor: colors.navy, borderWidth: 1, borderColor: "rgba(247,243,236,0.10)", borderTopLeftRadius: 6 },
  couple: { borderColor: colors.gold },
  error: { borderColor: "rgba(239,68,68,0.45)" },
  me: { backgroundColor: colors.ivory, borderBottomRightRadius: 6 },
  newLine: { flex: 1, height: 1, backgroundColor: colors.goldBorder },
});
