// The one-screen RSVP (build 12, prototype M4). No "Step 2 of 3".
//
//  - "Everyone's coming to everything" / "We can't make it" answer for the
//    whole party in one tap (N20).
//  - One paper card per named person, a Going / Can't go control per event
//    ("Voy / No voy" for you, "Va / No va" for the others, C8).
//  - The couple's questions keep their rules: general ones always, an event's
//    only while someone attends it; required ones (the meal question
//    included) must be answered before sending, here and on the server.
//  - An optional note for the couple ("notes" on the same submit).
//  - "Send reply" is docked above the tab bar, and rides the keyboard while
//    the note or an answer is typed. Something missing: the person (or the
//    questions card) is marked, the screen scrolls to it and buzzes (S5, S16).
//  - While the reply is pending, what the guest has filled in is kept as a
//    draft on the phone, so Home can say it is almost ready (S6).
//
// Same submit body as build 11 (roster with per-person events, answers),
// plus `notes`. The route stays /guest/rsvp for pushes and /i/ links.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { useGuestRsvp, type RsvpSummary } from "@/lib/hooks";
import { useGuestSession } from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, TopBar, Card, T, Badge, Input, Button, Row, Stack, Skeleton, SectionLabel, Chip, ChipRow, Icon, Field, useTabBarTop, TOOLBAR_SPACE } from "@/ui";
import { colors, fonts } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { guestErrorText, rsvpReason } from "@/features/guest/errors";
import { MAX_ROSTER, answersToSend, bi, isSelect, missingRequired, relevantQuestions } from "@/features/guest/rsvp";
import { dayMonth } from "@/features/guest/format";
import { GUEST_COPY } from "@/features/guest/copy";
import { useRsvpDraft } from "@/features/guest/state";

type Answer = "attending" | "declined";
type Seat = Record<string, Answer>;

const PAPER_LINE = "rgba(20,17,12,0.1)";
/** Error red that reads on cream paper (colors.red is for night). */
const PAPER_ERROR = "#b42318";

export default function RsvpAnswers() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const session = useGuestSession();
  const insets = useSafeAreaInsets();
  const tabBarTop = useTabBarTop();
  const mainQuery = useGuestRsvp();
  const { data, isLoading } = mainQuery;
  const payload = data?.payload;
  const summary = data?.summary;
  const { draft, saveDraft } = useRsvpDraft();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  // y of each scroll target inside the content (person cards, questions).
  // A Map, not a ref: written from onLayout, read when sending.
  const [ys] = useState(() => new Map<string, number>());
  const [dockH, setDockH] = useState(0);
  // The server stores at most 20 people per answer.
  const seatCount = payload ? Math.min(payload.maxParty, MAX_ROSTER) : 0;
  const changing = !!payload?.existing;
  const couple = session?.tenant.couple_names ?? "";
  const draftFor = payload ? `${payload.guestToken}:${payload.maxParty}` : null;

  // Seed from the existing answer (or the draft of a pending one) when the
  // payload or its version changes. State adjusted during render, keyed on the
  // payload identity; waits for the draft to load (undefined = loading).
  const seedKey = payload && draft !== undefined ? `${payload.guestToken}:${payload.existing?.respondedAt ?? ""}:${payload.maxParty}` : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (payload && seedKey && seedKey !== seededFor) {
    const existing = payload.existing;
    const fromDraft = !existing && draft && draft.for === draftFor ? draft : null;
    const initial: Seat[] = Array.from({ length: seatCount }, (_, i) => {
      if (fromDraft) return clean(fromDraft.seats[i] ?? {}, payload.events.map((e) => e.id));
      const comp = existing?.companions?.[i];
      if (comp?.events) return clean(comp.events, payload.events.map((e) => e.id));
      if (i === 0 && existing?.answers) return clean(existing.answers, payload.events.map((e) => e.id));
      return {};
    });
    setSeededFor(seedKey);
    setSeats(initial);
    setAnswers(fromDraft ? fromDraft.answers : existing?.questionAnswers ?? {});
    const n = fromDraft ? fromDraft.note : existing?.notes ?? "";
    setNote(n);
    setNoteOpen(!!n);
    setShowMissing(false);
    setError(null);
    setTouched(false);
  }

  // The draft: only while nothing has been sent, only after the guest changed
  // something, saved once typing pauses.
  useEffect(() => {
    if (!touched || changing || !draftFor) return;
    const t = setTimeout(() => saveDraft({ for: draftFor, seats, answers, note }), 400);
    return () => clearTimeout(t);
    // saveDraft is a new function each render; the key inside it is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, changing, draftFor, seats, answers, note]);

  const people = useMemo(() => {
    if (!payload) return [];
    return Array.from({ length: seatCount }, (_, i) => ({
      name: i === 0 ? payload.displayName : payload.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 }),
      first: (i === 0 ? payload.displayName : payload.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 })).split(" ")[0],
      you: i === 0,
    }));
  }, [payload, copy, seatCount]);

  const events = payload?.events ?? [];
  const personDone = (i: number) => events.every((e) => seats[i]?.[e.id]);
  const relevant = useMemo(() => relevantQuestions(payload?.questions ?? [], seats), [payload?.questions, seats]);
  const missing = useMemo(() => new Set(missingRequired(relevant, answers).map((q) => q.id)), [relevant, answers]);
  const missingPeople = showMissing ? people.map((_, i) => i).filter((i) => !personDone(i)) : [];
  const allState = seats.length && seats.every((s) => events.every((e) => s[e.id] === "attending")) ? "all" : seats.length && seats.every((s) => events.every((e) => s[e.id] === "declined")) ? "none" : null;
  const single = seatCount <= 1;

  function touch() {
    setTouched(true);
    if (error) setError(null);
  }
  function setSeat(i: number, eventId: string, v: Answer) {
    setSeats((prev) => prev.map((s, j) => (j === i ? { ...s, [eventId]: v } : s)));
    touch();
  }
  function setEveryone(v: Answer) {
    if (!payload) return;
    setSeats(Array.from({ length: seatCount }, () => Object.fromEntries(events.map((e) => [e.id, v]))));
    touch();
    // Coming to everything: what is left is the couple's questions (the meal).
    if (v === "attending" && (payload.questions ?? []).some((q) => q.required)) {
      setTimeout(() => scrollTo("questions"), 150);
    }
  }
  function setAnswer(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }));
    touch();
  }

  const scrollTo = (key: string) => {
    const y = ys.get(key);
    if (y === undefined) return;
    scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  const mark = (key: string) => (e: LayoutChangeEvent) => {
    ys.set(key, e.nativeEvent.layout.y);
  };

  async function submit() {
    if (!payload || busy) return;
    const firstMissing = people.findIndex((_, i) => !personDone(i));
    if (firstMissing >= 0 || missing.size) {
      setShowMissing(true);
      setError(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      scrollTo(firstMissing >= 0 ? `p${firstMissing}` : "questions");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const evs: Record<string, Answer> = {};
      for (const e of events) evs[e.id] = seats.some((s) => s[e.id] === "attending") ? "attending" : "declined";
      const companions = seats.map((s, i) => ({ name: i === 0 ? payload.displayName : payload.members[i - 1] ?? null, main: i === 0 ? true : undefined, events: s, attending: Object.values(s).some((v) => v === "attending") }));
      const r = await post<{ summary: RsvpSummary }>("/guest/rsvp", { events: evs, companions, answers: answersToSend(relevant, answers), notes: note.trim() || null });
      saveDraft(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ["guest-home"] }), qc.invalidateQueries({ queryKey: ["guest-rsvp"] }), qc.invalidateQueries({ queryKey: ["guest-schedule"] })]);
      router.push({ pathname: "/guest/rsvp/confirm", params: { status: r.summary.status } });
    } catch (err) {
      if (rsvpReason(err) === "missing_answers") {
        setShowMissing(true);
        scrollTo("questions");
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(guestErrorText(err, copy, lang));
    } finally {
      setBusy(false);
    }
  }

  const deadlinePassed = !!summary?.deadline_passed;
  const deadline = summary?.deadline ?? null;
  const intro = changing ? fmt(g.rsvp.introChange, { couple }) : deadline ? fmt(g.rsvp.introPending, { date: dayMonth(deadline, lang) }) : g.rsvp.introPendingNoDate;
  // Content ends above the docked button at rest (it sits over the tab bar).
  const restPad = Math.max(0, tabBarTop + 16 - insets.bottom);

  const dock = (
    <View onLayout={(e) => setDockH(Math.round(e.nativeEvent.layout.height))} style={{ gap: 8 }}>
      {error ? (
        <T v="meta13" color={colors.red} center accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </T>
      ) : showMissing && (missingPeople.length || missing.size) ? (
        <T v="meta13" color={colors.red} center accessibilityLiveRegion="polite">
          {missingPeople.length ? g.rsvp.pickFirst : g.rsvp.questionsMissing}
        </T>
      ) : null}
      <Button testID="rsvp-send" label={busy ? g.rsvp.sending : g.rsvp.send} onPress={submit} loading={busy} disabled={!payload || deadlinePassed} />
    </View>
  );

  return (
    <Screen query={mainQuery} header={<TopBar onBack={back} />} scroll={false} padded={false} keyboard dock={dock}>
      <KeyboardAwareScrollView
        ref={scroll}
        bottomOffset={dockH + 24 + TOOLBAR_SPACE + 16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: restPad + 16 }}
      >
        <View onLayout={mark("top")} style={styles.top}>
          <T v="title42" size={40} accessibilityRole="header">
            {g.rsvp.title}
          </T>
          {payload ? (
            <T v="body16" style={{ fontFamily: fonts.bodyMedium }}>
              {[payload.displayName, ...payload.members.slice(0, Math.max(0, seatCount - 1))].filter(Boolean).join(", ")}
            </T>
          ) : null}
          <T v="body15" color={colors.ivory70} style={{ marginTop: 4 }}>
            {intro}
          </T>
          {deadlinePassed ? (
            <T v="body15" color={colors.amber} style={{ marginTop: 8 }}>
              {copy.rsvp.deadlinePassed}
            </T>
          ) : null}
        </View>

        {payload && events.length ? (
          <View style={{ marginBottom: 16 }}>
            <ChipRow>
              <Chip testID="rsvp-all" label={single ? g.rsvp.allGoingOne : g.rsvp.allGoingParty} on={allState === "all"} onPress={() => setEveryone("attending")} />
              <Chip testID="rsvp-none" label={single ? g.rsvp.noneGoingOne : g.rsvp.noneGoingParty} on={allState === "none"} onPress={() => setEveryone("declined")} />
            </ChipRow>
          </View>
        ) : null}

        {isLoading && !payload ? (
          <Stack gap={16}>
            <Skeleton h={180} r={16} />
            <Skeleton h={180} r={16} />
          </Stack>
        ) : null}

        {people.map((p, i) => {
          const miss = missingPeople.includes(i);
          return (
            <View key={i} onLayout={mark(`p${i}`)} style={{ marginBottom: 16, gap: 8 }}>
              {miss ? (
                <Row gap={8} style={{ paddingHorizontal: 4 }}>
                  <Icon name="warning" size={18} color={colors.red} />
                  <T v="meta13" color={colors.red} style={{ fontFamily: fonts.bodyMedium, flex: 1 }} accessibilityRole="alert">
                    {p.you ? g.rsvp.missingYou : fmt(g.rsvp.missingOther, { name: p.first })}
                  </T>
                </Row>
              ) : null}
              <Card kind="paper" padding={16} style={[{ paddingBottom: 8 }, miss && styles.missCard]}>
                <Row gap={8} style={{ justifyContent: "space-between", paddingBottom: 8 }}>
                  <T v="name24" color={colors.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {p.name}
                  </T>
                  {p.you ? (
                    <View style={styles.youPill}>
                      <T v="meta13" size={13} color={colors.muted}>
                        {g.rsvp.you}
                      </T>
                    </View>
                  ) : null}
                </Row>
                {events.map((e) => {
                  const title = bi(e.title, lang);
                  const v = seats[i]?.[e.id] ?? null;
                  const need = miss && !v;
                  return (
                    <Row key={e.id} gap={12} style={styles.evRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T v="body15" color={colors.ink} style={{ fontFamily: fonts.bodyMedium }} numberOfLines={2}>
                          {title}
                        </T>
                        {need ? (
                          <Row gap={4}>
                            <Icon name="warning" size={14} color={colors.ink} />
                            <T v="meta13" size={13} color={colors.ink} style={{ fontFamily: fonts.bodySemibold }}>
                              {g.rsvp.missing}
                            </T>
                          </Row>
                        ) : e.time || e.cost ? (
                          <T v="meta13" size={13} color={colors.muted}>
                            {[e.time, e.cost].filter(Boolean).join(" · ")}
                          </T>
                        ) : null}
                      </View>
                      <PaperSegment
                        value={v}
                        need={need}
                        label={`${title}, ${p.first}`}
                        options={[
                          { value: "attending", label: p.you ? g.rsvp.goingYou : g.rsvp.goingOther },
                          { value: "declined", label: p.you ? g.rsvp.notGoingYou : g.rsvp.notGoingOther },
                        ]}
                        onChange={(x) => setSeat(i, e.id, x)}
                      />
                    </Row>
                  );
                })}
              </Card>
            </View>
          );
        })}

        {relevant.length ? (
          <View onLayout={mark("questions")} style={{ marginBottom: 16 }}>
            <Card kind="solid" padding={16} border={showMissing && missing.size ? colors.red : undefined}>
              <SectionLabel color={colors.goldLight}>{copy.rsvp.coupleAsks}</SectionLabel>
              <Stack gap={16} style={{ marginTop: 10 }}>
                {relevant.map((q) => {
                  const label = bi(q.label, lang);
                  const flagged = showMissing && missing.has(q.id);
                  return (
                    <View key={q.id} style={{ gap: 8 }}>
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        <T v="body16" color={flagged ? colors.red : colors.ivory} style={{ flexShrink: 1 }}>
                          {label}
                        </T>
                        {q.required ? <Badge label={copy.rsvp.required} kind={flagged ? "red" : "mute"} /> : null}
                      </Row>
                      {isSelect(q) ? (
                        <Row gap={8} style={{ flexWrap: "wrap" }}>
                          {(q.options ?? []).map((o) => {
                            const on = answers[q.id] === o.id;
                            return (
                              <Chip
                                key={o.id}
                                label={bi(o.label, lang)}
                                on={on}
                                // An optional answer can be taken back by tapping it again.
                                onPress={() => setAnswer(q.id, on && !q.required ? "" : o.id)}
                              />
                            );
                          })}
                        </Row>
                      ) : (
                        <Input
                          value={answers[q.id] ?? ""}
                          onChangeText={(t) => setAnswer(q.id, t.slice(0, 200))}
                          placeholder={copy.rsvp.answerPlaceholder}
                          accessibilityLabel={label}
                          style={{ minHeight: 48, borderColor: flagged ? colors.red : undefined }}
                        />
                      )}
                    </View>
                  );
                })}
              </Stack>
            </Card>
          </View>
        ) : null}

        {payload ? (
          <View onLayout={mark("note")} style={{ marginBottom: 8 }}>
            {noteOpen ? (
              <Field label={`${fmt(g.rsvp.noteLabel, { couple })} · ${g.rsvp.optional}`}>
                <Input
                  testID="rsvp-note"
                  value={note}
                  onChangeText={(t) => {
                    setNote(t.slice(0, 500));
                    touch();
                  }}
                  placeholder={g.rsvp.notePlaceholder}
                  multiline
                  autoFocus={!note}
                />
              </Field>
            ) : (
              <Button label={g.rsvp.addNote} kind="text" icon="plus" full={false} onPress={() => setNoteOpen(true)} style={{ marginLeft: -8 }} />
            )}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

/** Only answers for events this guest is invited to now. */
function clean(src: Record<string, string>, ids: string[]): Seat {
  const out: Seat = {};
  for (const [k, v] of Object.entries(src)) if (ids.includes(k) && (v === "attending" || v === "declined")) out[k] = v;
  return out;
}

/** Two-option control drawn for the paper cards (ink on cream, gold when on). */
function PaperSegment({ value, options, onChange, label, need }: { value: Answer | null; options: { value: Answer; label: string }[]; onChange: (v: Answer) => void; label: string; need?: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, need && styles.segNeed]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.segOpt, on && styles.segOn]}
          >
            <T v="meta13" size={14} color={colors.ink} center numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: on ? fonts.bodySemibold : fonts.bodyMedium }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { gap: 4, paddingTop: 4, paddingBottom: 16, paddingHorizontal: 4 },
  missCard: { borderWidth: 2, borderColor: PAPER_ERROR },
  youPill: { borderWidth: 1, borderColor: "rgba(20,17,12,0.28)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  evRow: { minHeight: 60, borderTopWidth: 1, borderTopColor: PAPER_LINE, paddingVertical: 6 },
  seg: { width: 164, flexDirection: "row", borderRadius: 999, borderWidth: 1, borderColor: "rgba(20,17,12,0.28)", padding: 3, gap: 2 },
  segNeed: { borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.ink },
  segOpt: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segOn: { backgroundColor: colors.gold },
});
