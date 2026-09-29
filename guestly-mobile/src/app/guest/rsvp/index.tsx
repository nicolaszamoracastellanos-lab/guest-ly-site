// Who is coming: attending or declined per person per event, then the
// couple's questions, then submit. Same roster shape and the same question
// rules as the web wizard: general questions are always asked, an event's
// questions only while someone attends it, and required ones are checked here
// before the server would refuse them.

import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { post } from "@/lib/api";
import { useGuestRsvp, type RsvpSummary } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, TopBar, BigTitle, Card, T, Badge, Segmented, Input, Button, Row, Stack, Skeleton, SectionLabel, Chip } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { guestErrorText, rsvpReason } from "@/features/guest/errors";
import { MAX_ROSTER, answersToSend, bi, isSelect, missingRequired, relevantQuestions } from "@/features/guest/rsvp";

type Answer = "attending" | "declined";

export default function RsvpAnswers() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const mainQuery = useGuestRsvp();
  const { data, isLoading } = mainQuery;
  const payload = data?.payload;
  const [seats, setSeats] = useState<Record<string, Answer>[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  // The server stores at most 20 people per answer.
  const seatCount = payload ? Math.min(payload.maxParty, MAX_ROSTER) : 0;

  // Seed from the existing answer when the payload (or its version) changes.
  // State adjusted during render, keyed on the payload identity.
  const seedKey = payload ? `${payload.guestToken}:${payload.existing?.respondedAt ?? ""}:${payload.maxParty}` : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (payload && seedKey !== seededFor) {
    const existing = payload.existing;
    const initial: Record<string, Answer>[] = Array.from({ length: seatCount }, (_, i) => {
      const comp = existing?.companions?.[i];
      if (comp?.events) {
        const out: Record<string, Answer> = {};
        for (const [k, v] of Object.entries(comp.events)) if (v === "attending" || v === "declined") out[k] = v;
        return out;
      }
      if (i === 0 && existing?.answers) {
        const out: Record<string, Answer> = {};
        for (const [k, v] of Object.entries(existing.answers)) if (v === "attending" || v === "declined") out[k] = v;
        return out;
      }
      return {};
    });
    setSeededFor(seedKey);
    setSeats(initial);
    setAnswers(existing?.questionAnswers ?? {});
    setShowMissing(false);
    setError(null);
  }

  const people = useMemo(() => {
    if (!payload) return [];
    return Array.from({ length: seatCount }, (_, i) => ({
      name: i === 0 ? payload.displayName : payload.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 }),
      tag: i === 0 ? copy.rsvp.you : copy.rsvp.partyMember,
      kind: i === 0 ? ("gold" as const) : ("mute" as const),
    }));
  }, [payload, copy, seatCount]);

  const complete = payload ? seats.length === seatCount && seats.every((s) => payload.events.every((e) => s[e.id])) : false;
  const relevant = useMemo(() => relevantQuestions(payload?.questions ?? [], seats), [payload?.questions, seats]);
  const missing = useMemo(() => new Set(missingRequired(relevant, answers).map((q) => q.id)), [relevant, answers]);

  function setAnswer(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (error) setError(null);
  }

  async function submit() {
    if (!payload || !complete) {
      setError(copy.rsvp.needsAnswer);
      return;
    }
    if (missing.size) {
      setShowMissing(true);
      setError(copy.rsvp.requiredMissing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const events: Record<string, Answer> = {};
      for (const e of payload.events) events[e.id] = seats.some((s) => s[e.id] === "attending") ? "attending" : "declined";
      const companions = seats.map((s, i) => ({ name: i === 0 ? payload.displayName : payload.members[i - 1] ?? null, main: i === 0 ? true : undefined, events: s, attending: Object.values(s).some((v) => v === "attending") }));
      const r = await post<{ summary: RsvpSummary }>("/guest/rsvp", { events, companions, answers: answersToSend(relevant, answers) });
      await Promise.all([qc.invalidateQueries({ queryKey: ["guest-home"] }), qc.invalidateQueries({ queryKey: ["guest-rsvp"] })]);
      router.push({ pathname: "/guest/rsvp/confirm", params: { status: r.summary.status } });
    } catch (err) {
      if (rsvpReason(err) === "missing_answers") setShowMissing(true);
      setError(guestErrorText(err, copy, lang));
    } finally {
      setBusy(false);
    }
  }

  const deadlinePassed = data?.summary.deadline_passed;

  return (
    <Screen query={mainQuery} header={<TopBar onBack={back} title={`${copy.guestHome.tabs.rsvp} · ${payload?.displayName ?? ""}`} />} bottomInset={40} keyboard refresh>
      <>
        <BigTitle label={copy.rsvp.step2} title={copy.rsvp.whoIsComing} sub={copy.rsvp.perPerson} size={38} />
        {deadlinePassed ? (
          <T v="body15" color={colors.amber} style={{ marginTop: 12 }}>
            {copy.rsvp.deadlinePassed}
          </T>
        ) : null}
        <Stack gap={10} style={{ marginTop: 22 }}>
          {isLoading && !payload ? (
            <>
              <Skeleton h={140} r={18} />
              <Skeleton h={140} r={18} />
            </>
          ) : null}
          {people.map((p, i) => (
            <Card key={i} kind="solid" padding={14}>
              {/* The name gives way and the badge drops under it when both do not fit:
                  with large text ACOMPAÑANTE ran past the card's edge. */}
              <Row gap={8} style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 6 }}>
                <T v="name24" style={{ flexShrink: 1 }}>{p.name}</T>
                <Badge label={p.tag} kind={p.kind} />
              </Row>
              {payload?.events.map((e) => {
                const title = bi(e.title, lang);
                return (
                  <Row key={e.id} style={{ justifyContent: "space-between", minHeight: 48 }}>
                    <View style={{ flex: 1 }}>
                      <T v="body16">{title}</T>
                      {e.cost ? (
                        <T v="meta13" color={colors.ivory55}>
                          {e.cost}
                        </T>
                      ) : null}
                    </View>
                    <View style={{ width: 176 }} accessibilityLabel={`${p.name}, ${title}`}>
                      <Segmented<Answer>
                        value={seats[i]?.[e.id] ?? null}
                        options={[
                          { value: "attending", label: copy.rsvp.attending },
                          { value: "declined", label: copy.rsvp.declined },
                        ]}
                        onChange={(v) => {
                          setSeats((prev) => prev.map((s, j) => (j === i ? { ...s, [e.id]: v } : s)));
                          if (error) setError(null);
                        }}
                      />
                    </View>
                  </Row>
                );
              })}
            </Card>
          ))}
          {relevant.length ? (
            <Card kind="solid" padding={14}>
              <SectionLabel color={colors.goldLight}>{copy.rsvp.coupleAsks}</SectionLabel>
              <Stack gap={14} style={{ marginTop: 8 }}>
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
          ) : null}
        </Stack>
        {error ? (
          <T v="body15" color={colors.red} style={{ marginTop: 12 }} accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        <Button
          label={payload?.existing ? copy.rsvp.update : copy.rsvp.submit}
          onPress={submit}
          loading={busy}
          disabled={!payload || deadlinePassed}
          style={{ marginTop: 24 }}
        />
      </>
    </Screen>
  );
}
