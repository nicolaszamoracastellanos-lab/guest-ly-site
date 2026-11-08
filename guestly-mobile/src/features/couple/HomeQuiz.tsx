// The five questions that build the customizable Home (Oct 31 2026): what to
// see first, how much detail, when Guest-ly checks in, who plans with you,
// and whether Home changes as the date nears. Opened from Home (first visit,
// or Change my answers). Build saves the answers, the cards they suggest and
// the caller's own recap; Skip saves the standard Home. One completion covers
// both partners; the recap is per person.

import React, { useMemo, useState } from "react";
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useSafeBack } from "@/lib/nav";
import { Screen, TopBar, T, Row, Stack, Button, Chip, Gem, toast, toastError } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { FOCUS_IDS, STANDARD_ANSWERS, suggestedCards, type Focus, type HomeAnswers } from "./homeLayout";
import { readLayout, useSaveHomeLayout, type CoupleHomeWithLayout, type RecapPref } from "./homeCards";
import { HOME_COPY, hourLabel } from "./homeCopy";
import { onlyServed } from "./road";

const STEPS = 5;
const HOURS = [6, 7, 8, 9, 10, 12, 13, 17, 18, 19, 20, 21];

export function HomeQuiz() {
  const c = useFeatureCopy(HOME_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const save = useSaveHomeLayout();
  // Changing the answers starts from the saved ones; the first time, from nothing picked.
  const start = useMemo(() => {
    const l = readLayout(qc.getQueryData<CoupleHomeWithLayout>(["couple-home"])?.layout);
    const answers: HomeAnswers = l?.configured ? l.answers : { ...STANDARD_ANSWERS, focus: [] };
    const recap: RecapPref = l?.recap ?? { cadence: answers.when, weekday: 1, hour: 8 };
    return { answers, recap, served: l?.served ?? null };
  }, [qc]);
  const [a, setA] = useState<HomeAnswers>(start.answers);
  const [weekday, setWeekday] = useState(start.recap.weekday);
  const [hour, setHour] = useState(start.recap.hour);
  const [step, setStep] = useState(0);

  const close = () => (router.canGoBack() ? router.back() : back());
  const finish = async (skip: boolean) => {
    const answers = skip ? STANDARD_ANSWERS : a;
    try {
      await save.mutateAsync({
        answers,
        // K8: a card the server did not show this phone is left to the server.
        cards: onlyServed(suggestedCards(answers), start.served),
        dismissed: [],
        quiz_state: skip ? "skipped" : "done",
        ...(skip ? {} : { recap: { cadence: a.when, weekday, hour } }),
      });
      toast(c.saved);
      close();
    } catch {
      // The quiz stays open: the toast shows on its own host, over the modal.
      toastError(c.saveFailed);
    }
  };

  const toggleFocus = (f: Focus) =>
    setA((p) => {
      if (p.focus.includes(f)) return { ...p, focus: p.focus.filter((x) => x !== f) };
      return p.focus.length >= 3 ? p : { ...p, focus: [...p.focus, f] };
    });

  const q = c.q[step];
  const canNext = step !== 0 || a.focus.length > 0;

  return (
    <Screen modal header={<TopBar title="" left={null} right={<Pressable onPress={close} accessibilityRole="button" accessibilityLabel={c.close} hitSlop={10}><T v="meta13" color={colors.ivory70}>{c.close}</T></Pressable>} />} bottomInset={40}>
      <Stack gap={18} style={{ marginTop: 8 }}>
        <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={c.question(step + 1, STEPS)}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotOn]} />
          ))}
          <T v="meta13" color={colors.ivory55} style={{ marginLeft: 8 }}>
            {c.question(step + 1, STEPS)}
          </T>
        </View>
        <View style={{ gap: 6 }}>
          <T v="title30" accessibilityRole="header">
            {q.title}
          </T>
          <T v="body15" color={colors.ivory70}>
            {q.sub}
          </T>
        </View>

        {step === 0 ? (
          <Stack gap={10}>
            {FOCUS_IDS.map((f) => {
              const on = a.focus.includes(f);
              return <Option key={f} title={c.focus[f].title} sub={c.focus[f].sub} on={on} disabled={!on && a.focus.length >= 3} onPress={() => toggleFocus(f)} testID={`quiz-focus-${f}`} />;
            })}
          </Stack>
        ) : step === 1 ? (
          <Stack gap={10}>
            {(["glance", "balanced", "full"] as const).map((k) => (
              <Option key={k} title={c.detail[k].title} sub={c.detail[k].sub} on={a.detail === k} onPress={() => setA((p) => ({ ...p, detail: k }))} testID={`quiz-detail-${k}`} />
            ))}
          </Stack>
        ) : step === 2 ? (
          <Stack gap={10}>
            {(["daily", "weekly", "needed"] as const).map((k) => (
              <Option key={k} title={c.when[k].title} sub={c.when[k].sub} on={a.when === k} onPress={() => setA((p) => ({ ...p, when: k }))} testID={`quiz-when-${k}`} />
            ))}
            {a.when === "weekly" ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                <T v="label11" color={colors.goldLight}>
                  {c.day}
                </T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <Chip key={d} label={c.weekdays[d]} on={weekday === d} onPress={() => setWeekday(d)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {a.when !== "needed" ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                <T v="label11" color={colors.goldLight}>
                  {c.time}
                </T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                  {HOURS.map((h) => (
                    <Chip key={h} label={hourLabel(h, lang)} on={hour === h} onPress={() => setHour(h)} />
                  ))}
                </ScrollView>
                <T v="meta13" color={colors.ivory55}>
                  {c.tz}
                </T>
              </View>
            ) : null}
          </Stack>
        ) : step === 3 ? (
          <Stack gap={10}>
            {(["solo", "partner", "planner"] as const).map((k) => (
              <Option key={k} title={c.team[k].title} sub={c.team[k].sub} on={a.team === k} onPress={() => setA((p) => ({ ...p, team: k }))} testID={`quiz-team-${k}`} />
            ))}
          </Stack>
        ) : (
          <Stack gap={10}>
            <Option title={c.adapt.yes.title} sub={c.adapt.yes.sub} on={a.adapt} onPress={() => setA((p) => ({ ...p, adapt: true }))} testID="quiz-adapt-yes" />
            <Option title={c.adapt.no.title} sub={c.adapt.no.sub} on={!a.adapt} onPress={() => setA((p) => ({ ...p, adapt: false }))} testID="quiz-adapt-no" />
          </Stack>
        )}

        <Row gap={10} style={{ marginTop: 6 }}>
          <View style={{ flex: 1 }}>
            {step > 0 ? <Button label={c.back} kind="glass" small onPress={() => setStep((s) => s - 1)} testID="quiz-back" /> : <Button label={c.skip} kind="text" small onPress={() => void finish(true)} disabled={save.isPending} testID="quiz-skip" />}
          </View>
          <View style={{ flex: 1 }}>
            {step < STEPS - 1 ? <Button label={c.nextStep} small onPress={() => setStep((s) => s + 1)} disabled={!canNext} testID="quiz-next" /> : <Button label={c.build} small onPress={() => void finish(false)} loading={save.isPending} testID="quiz-build" />}
          </View>
        </Row>
      </Stack>
    </Screen>
  );
}

function Option({ title, sub, on, disabled, onPress, testID }: { title: string; sub: string; on: boolean; disabled?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!disabled }} accessibilityLabel={`${title}. ${sub}`} testID={testID} style={({ pressed }) => [styles.opt, on && styles.optOn, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body16">{title}</T>
        <T v="meta13" color={colors.ivory55}>
          {sub}
        </T>
      </View>
      {on ? <Gem size={9} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 26, height: 3, borderRadius: 3, backgroundColor: colors.ivory14 },
  dotOn: { backgroundColor: colors.gold },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.glassSolidFill },
  optOn: { borderColor: colors.gold, backgroundColor: colors.goldWash },
});
