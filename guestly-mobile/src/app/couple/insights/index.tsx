// Concierge insights: gaps to fix, who waits on you, top questions, sentiment.

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useFeatureCopy } from "@/i18n/feature";
import { relTime, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, T, Badge, Button, Input, Row, Stack, StatTile, SectionLabel, EmptyState, Skeleton, Gem } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/insights/copy";
import { useInsights, INSIGHTS_KEY } from "@/features/insights/hooks";
import { BRAIN_KEY } from "@/features/brain/hooks";

export default function Insights() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data, isLoading } = useInsights();
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function fail(err: unknown) {
    Alert.alert(err instanceof ApiFailure ? err.messages[lang] : "");
  }
  async function refresh() {
    await Promise.all([qc.invalidateQueries({ queryKey: INSIGHTS_KEY }), qc.invalidateQueries({ queryKey: BRAIN_KEY }), qc.invalidateQueries({ queryKey: ["couple-home"] })]);
  }
  async function publishAnswer(question: string) {
    if (!answer.trim()) return;
    setBusy(question);
    try {
      await post("/couple/insights/gaps/answer", { question, answer: answer.trim() });
      setAnswering(null);
      setAnswer("");
      setNotice(c.answered);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(question: string) {
    setBusy(question);
    try {
      await post("/couple/insights/gaps/dismiss", { question });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }
  async function resolve(question: string) {
    setBusy(question);
    try {
      await post("/couple/insights/escalations/resolve", { question });
      setNotice(c.resolved);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  const t = data?.totals ?? null;
  const maxCount = Math.max(1, ...(data?.top_questions.map((q) => q.count) ?? [1]));

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.title} sub={c.subtitle} size={36} />
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={80} />
          <Skeleton h={120} />
        </Stack>
      ) : null}
      {data && !t ? (
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 12 }}>
          {c.statsUnavailable}
        </T>
      ) : null}
      {t ? (
        <View style={{ marginTop: 20 }}>
          <SectionLabel style={{ marginBottom: 8 }}>{c.window(t.window_days)}</SectionLabel>
          <Row gap={8}>
            <StatTile value={String(t.guest_messages_window)} label={c.messages} />
            <StatTile value={String(t.unique_guests)} label={c.guests} />
            <StatTile value={t.deflection_rate !== null ? `${Math.round(t.deflection_rate * 100)}%` : "·"} label={c.deflection} color={colors.goldLight} />
          </Row>
          <Row gap={8} style={{ marginTop: 8 }}>
            <StatTile value={String(t.gaps_total)} label={c.gapsTitle} color={t.gaps_total ? colors.amber : colors.ivory} />
            <StatTile value={String(t.attention_conversations)} label={c.attention} color={t.attention_conversations ? colors.red : colors.ivory} />
          </Row>
        </View>
      ) : null}
      {notice ? (
        <T v="body15" color={colors.greenText} style={{ marginTop: 12 }}>
          {notice}
        </T>
      ) : null}
      {!canEdit ? (
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 12 }}>
          {c.readOnly}
        </T>
      ) : null}

      <SectionLabel style={{ marginTop: 26 }}>{c.gapsTitle}</SectionLabel>
      <T v="meta13" color={colors.ivory55} style={{ marginTop: 4, marginBottom: 10 }}>
        {c.gapsSub}
      </T>
      {data && !data.gaps.length ? <EmptyState title={c.gapsEmpty} /> : null}
      <Stack gap={10}>
        {(data?.gaps ?? []).map((g) => (
          <Card key={g.question} kind="solid" padding={14}>
            <T v="body16" color={colors.ivory90}>
              {g.question}
            </T>
            <Row gap={8} style={{ marginTop: 6 }}>
              <Badge label={g.channel} kind="mute" />
              <T v="meta13" color={colors.ivory55}>
                {c.asked(g.occurrences)} · {relTime(g.created_at, lang)}
              </T>
            </Row>
            {canEdit ? (
              answering === g.question ? (
                <Stack gap={8} style={{ marginTop: 12 }}>
                  <Input value={answer} onChangeText={setAnswer} placeholder={c.answerPlaceholder} multiline autoFocus style={{ minHeight: 96, alignItems: "flex-start", paddingVertical: 12 }} />
                  <Row gap={8}>
                    <View style={{ flex: 1 }}>
                      <Button label={c.publishAnswer} small onPress={() => publishAnswer(g.question)} loading={busy === g.question} disabled={!answer.trim()} />
                    </View>
                    <Button label={c.dismiss} kind="text" small full={false} onPress={() => { setAnswering(null); setAnswer(""); }} />
                  </Row>
                </Stack>
              ) : (
                <Row gap={8} style={{ marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button label={c.answer} small kind="glass" icon="edit" onPress={() => { setAnswering(g.question); setAnswer(""); }} />
                  </View>
                  <Button label={c.dismiss} kind="text" small full={false} loading={busy === g.question} onPress={() => dismiss(g.question)} />
                </Row>
              )
            ) : null}
          </Card>
        ))}
      </Stack>

      <SectionLabel style={{ marginTop: 26 }}>{c.escalationsTitle}</SectionLabel>
      <T v="meta13" color={colors.ivory55} style={{ marginTop: 4, marginBottom: 10 }}>
        {c.escalationsSub}
      </T>
      {data && !data.escalations.length ? <EmptyState title={c.escalationsEmpty} /> : null}
      <Stack gap={10}>
        {(data?.escalations ?? []).map((e) => (
          <Card key={e.question} kind="solid" padding={14}>
            <Row gap={10} align="flex-start">
              <View style={{ paddingTop: 8 }}>
                <Gem size={6} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body16" color={colors.ivory90}>
                  {e.question}
                </T>
                <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
                  {[e.guest, e.channel, c.asked(e.occurrences), relTime(e.last_asked, lang)].filter(Boolean).join(" · ")}
                </T>
              </View>
            </Row>
            <Row gap={8} style={{ marginTop: 12 }}>
              {e.conversation_id ? (
                <View style={{ flex: 1 }}>
                  <Button label={c.openConversation} small kind="glass" icon="chat" onPress={() => router.push({ pathname: "/couple/messages/[id]", params: { id: e.conversation_id! } })} />
                </View>
              ) : null}
              {canEdit ? <Button label={c.resolve} kind="text" small full={false} loading={busy === e.question} onPress={() => resolve(e.question)} /> : null}
            </Row>
          </Card>
        ))}
      </Stack>

      <SectionLabel style={{ marginTop: 26, marginBottom: 10 }}>{c.topTitle}</SectionLabel>
      {data && !data.top_questions.length ? <EmptyState title={c.topEmpty} /> : null}
      <Card kind="solid" padding={14}>
        <Stack gap={12}>
          {(data?.top_questions ?? []).map((q, i) => {
            const delta = q.count - q.previous;
            const trend = q.previous === 0 ? c.trendNew : delta > 0 ? c.trendUp(delta) : delta < 0 ? c.trendDown(delta) : c.trendFlat;
            return (
              <View key={q.intent} style={{ gap: 6 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T v="body16">
                    {i + 1}. {q.label}
                  </T>
                  <Row gap={8}>
                    <T v="meta13" color={delta > 0 ? colors.greenText : colors.ivory55}>
                      {trend}
                    </T>
                    <T v="body16" color={colors.goldLight}>
                      {q.count}
                    </T>
                  </Row>
                </Row>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.ivory09 }}>
                  <View style={{ height: 4, borderRadius: 2, width: `${Math.round((q.count / maxCount) * 100)}%`, backgroundColor: colors.gold }} />
                </View>
                {q.sample ? (
                  <T v="meta13" color={colors.ivory55}>
                    {`"${q.sample}"`}
                  </T>
                ) : null}
              </View>
            );
          })}
        </Stack>
      </Card>

      {data?.daily.length ? (
        <View style={{ marginTop: 26 }}>
          <SectionLabel style={{ marginBottom: 10 }}>{c.activity}</SectionLabel>
          <Card kind="solid" padding={14}>
            <Row gap={4} align="flex-end" style={{ height: 72 }}>
              {data.daily.map((d) => {
                const max = Math.max(1, ...data.daily.map((x) => x.web + x.whatsapp));
                const total = d.web + d.whatsapp;
                return (
                  <View key={d.day} style={{ flex: 1, alignItems: "stretch", justifyContent: "flex-end", height: 72 }}>
                    <View style={{ height: Math.max(2, Math.round((total / max) * 68)), borderRadius: 3, backgroundColor: total ? colors.gold : colors.ivory14 }} />
                  </View>
                );
              })}
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: 8 }}>
              <T v="meta13" color={colors.ivory40}>
                {data.daily[0]?.day.slice(5)}
              </T>
              <T v="meta13" color={colors.ivory40}>
                {data.daily[data.daily.length - 1]?.day.slice(5)}
              </T>
            </Row>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
