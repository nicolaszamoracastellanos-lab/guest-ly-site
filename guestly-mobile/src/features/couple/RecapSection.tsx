// Settings > Notifications: "Your recap" (Oct 31 2026). The same choice as the
// Home quiz's third question (when Guest-ly checks in), per person: daily at
// an hour, weekly on a day at an hour, or only when something needs you.
// Shown only when the portal sends the Home layout (older portals: nothing).

import React from "react";
import { View, ScrollView } from "react-native";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useCoupleHome } from "@/lib/hooks";
import { T, Card, Chip, Segmented, SectionLabel, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { readLayout, useSaveHomeLayout, type CoupleHomeWithLayout, type RecapPref } from "./homeCards";
import { HOME_COPY, hourLabel, recapLine } from "./homeCopy";

const HOURS = [6, 7, 8, 9, 10, 12, 13, 17, 18, 19, 20, 21];

export function RecapSection() {
  const c = useFeatureCopy(HOME_COPY);
  const { lang } = useLang();
  const home = useCoupleHome();
  const save = useSaveHomeLayout();
  const layout = readLayout((home.data as CoupleHomeWithLayout | undefined)?.layout);
  if (!layout) return null;
  const r: RecapPref = layout.recap ?? { cadence: layout.answers.when, weekday: 1, hour: 8 };
  const set = (next: Partial<RecapPref>) =>
    save.mutate({ recap: { ...r, ...next } }, { onError: () => toastError(c.saveFailed) });

  return (
    <>
      <SectionLabel style={{ marginTop: 8 }}>{c.recapTitle}</SectionLabel>
      <Card kind="solid" padding={16}>
        <T v="body16">{recapLine(c, r, lang)}</T>
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 2, marginBottom: 12 }}>
          {c.recapHint}
        </T>
        <Segmented
          value={r.cadence}
          options={[
            { value: "daily", label: c.when.daily.title },
            { value: "weekly", label: c.when.weekly.title },
            { value: "needed", label: c.recapNeeded },
          ]}
          onChange={(cadence) => set({ cadence })}
        />
        {r.cadence === "weekly" ? (
          <View style={{ gap: 6, marginTop: 12 }}>
            <T v="label11" color={colors.goldLight}>
              {c.day}
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Chip key={d} label={c.weekdays[d]} on={r.weekday === d} onPress={() => set({ weekday: d })} />
              ))}
            </ScrollView>
          </View>
        ) : null}
        {r.cadence !== "needed" ? (
          <View style={{ gap: 6, marginTop: 12 }}>
            <T v="label11" color={colors.goldLight}>
              {c.time}
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, HOURS.indexOf(r.hour) - 1) * 80, y: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
              {HOURS.map((h) => (
                <Chip key={h} label={hourLabel(h, lang)} on={r.hour === h} onPress={() => set({ hour: h })} />
              ))}
            </ScrollView>
            <T v="meta13" color={colors.ivory55}>
              {c.tz}
            </T>
          </View>
        ) : null}
      </Card>
    </>
  );
}
