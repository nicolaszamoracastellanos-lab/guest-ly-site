// Who is coming: attending or declined per person per event, then the
// couple's questions, then submit. Same roster shape as the web wizard.

import React, { useMemo, useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useGuestRsvp, type GuestPayload, type RsvpSummary } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, TopBar, BigTitle, Card, T, Badge, Segmented, Input, Button, Row, Stack, Skeleton, SectionLabel, Chip } from "@/ui";
import { colors } from "@/ui/tokens";

type Answer = "attending" | "declined";

export default function RsvpAnswers() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useGuestRsvp();
  const payload = data?.payload;
  const [seats, setSeats] = useState<Record<string, Answer>[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Seed from the existing answer when the payload (or its version) changes.
  // State adjusted during render, keyed on the payload identity.
  const seedKey = payload ? `${payload.guestToken}:${payload.existing?.respondedAt ?? ""}:${payload.maxParty}` : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (payload && seedKey !== seededFor) {
    const count = payload.maxParty;
    const existing = payload.existing;
    const initial: Record<string, Answer>[] = Array.from({ length: count }, (_, i) => {
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
  }

  const people = useMemo(() => {
    if (!payload) return [];
    return Array.from({ length: payload.maxParty }, (_, i) => ({
      name: i === 0 ? payload.displayName : payload.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 }),
      tag: i === 0 ? copy.rsvp.you : copy.rsvp.partyMember,
      kind: i === 0 ? ("gold" as const) : ("mute" as const),
    }));
  }, [payload, copy]);

  const complete = payload ? seats.every((s) => payload.events.every((e) => s[e.id])) && seats.length === payload.maxParty : false;
  const anyAttending = seats.some((s) => Object.values(s).some((v) => v === "attending"));
  const questions = payload?.questions ?? [];

  async function submit() {
    if (!payload || !complete) {
      setError(copy.rsvp.needsAnswer);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const events: Record<string, Answer> = {};
      for (const e of payload.events) events[e.id] = seats.some((s) => s[e.id] === "attending") ? "attending" : "declined";
      const companions = seats.map((s, i) => ({ name: i === 0 ? payload.displayName : payload.members[i - 1] ?? null, main: i === 0 ? true : undefined, events: s, attending: Object.values(s).some((v) => v === "attending") }));
      const r = await post<{ summary: RsvpSummary }>("/guest/rsvp", { events, companions, answers });
      await qc.invalidateQueries({ queryKey: ["guest-home"] });
      await qc.invalidateQueries({ queryKey: ["guest-rsvp"] });
      router.push({ pathname: "/guest/rsvp/confirm", params: { status: r.summary.status, hasContact: payload.hasContact ? "1" : "0" } });
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : copy.common.error);
    } finally {
      setBusy(false);
    }
  }

  const deadlinePassed = data?.summary.deadline_passed;

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={`${copy.guestHome.tabs.rsvp} · ${payload?.displayName ?? ""}`} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
              <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <T v="name24">{p.name}</T>
                <Badge label={p.tag} kind={p.kind} />
              </Row>
              {payload?.events.map((e) => (
                <Row key={e.id} style={{ justifyContent: "space-between", minHeight: 48 }}>
                  <View style={{ flex: 1 }}>
                    <T v="body16">{e.title[lang] || e.title.en}</T>
                    {e.cost ? (
                      <T v="meta13" color={colors.ivory55}>
                        {e.cost}
                      </T>
                    ) : null}
                  </View>
                  <View style={{ width: 176 }}>
                    <Segmented<Answer>
                      value={seats[i]?.[e.id] ?? null}
                      options={[
                        { value: "attending", label: copy.rsvp.attending },
                        { value: "declined", label: copy.rsvp.declined },
                      ]}
                      onChange={(v) => setSeats((prev) => prev.map((s, j) => (j === i ? { ...s, [e.id]: v } : s)))}
                    />
                  </View>
                </Row>
              ))}
            </Card>
          ))}
          {questions.length && anyAttending ? (
            <Card kind="solid" padding={14}>
              <SectionLabel color={colors.goldLight}>{copy.rsvp.coupleAsks}</SectionLabel>
              <Stack gap={12} style={{ marginTop: 8 }}>
                {questions.map((q) => (
                  <View key={q.id} style={{ gap: 8 }}>
                    <T v="body16">{q.label[lang] ?? q.label.en ?? ""}</T>
                    {q.options?.length ? (
                      <Row gap={8} style={{ flexWrap: "wrap" }}>
                        {q.options.map((o) => (
                          <Chip key={o.id} label={o.label[lang] ?? o.label.en ?? o.id} on={answers[q.id] === o.id} onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} />
                        ))}
                      </Row>
                    ) : (
                      <Input value={answers[q.id] ?? ""} onChangeText={(t) => setAnswers((a) => ({ ...a, [q.id]: t.slice(0, 200) }))} placeholder={copy.rsvp.answerPlaceholder} style={{ minHeight: 48 }} />
                    )}
                  </View>
                ))}
              </Stack>
            </Card>
          ) : null}
        </Stack>
        {error ? (
          <T v="body15" color={colors.red} style={{ marginTop: 12 }}>
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
      </KeyboardAvoidingView>
    </Screen>
  );
}
