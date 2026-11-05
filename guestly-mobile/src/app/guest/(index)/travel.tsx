// #26 "Your travel" (1.4.0, MW_TRAVEL_WINDOWS, the couple asks for travel):
// the party's arrival and departure, each with a date, the local time, where
// (one of the couple's pickup points or a typed place) and a flight or bus
// number. One Save, the same rules as the wedding site (the server checks
// them; its sentence shows under the form). A 404 (not asked, or off) sends
// the guest back: Home only shows the row while GET answers.

import React, { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure, post } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { failedText } from "@/features/shared/requests";
import { Screen, TopBar, BigTitle, Card, T, Input, Field, Chip, ChipRow, Stack, Skeleton, Button, EmptyState, toast } from "@/ui";
import { DateInput, TimeInput } from "@/ui/Pickers";
import { colors } from "@/ui/tokens";
import { TRAVEL_COPY } from "@/features/travel/copy";
import { GUEST_TRAVEL_KEY, useGuestTravel } from "@/features/travel/hooks";
import { EMPTY_LEG, isKnownPoint, legProblem, readGuestTravel, travelBody, type GuestTravel, type TravelLeg } from "@/features/travel/core";

export default function GuestTravelScreen() {
  const c = useFeatureCopy(TRAVEL_COPY);
  const { lang } = useLang();
  const common = useCopy().common;
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const q = useGuestTravel();
  const data = q.data ?? null;
  const [draft, setDraft] = useState<{ arrival: TravelLeg; departure: TravelLeg } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = draft ?? (data ? data.travel : { arrival: EMPTY_LEG, departure: EMPTY_LEG });
  const leave = useUnsavedGuard(!!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.travel));

  const setLeg = (which: "arrival" | "departure", patch: Partial<TravelLeg>) => {
    setError(null);
    setDraft({ ...current, [which]: { ...current[which], ...patch } });
  };

  async function save() {
    if (busy) return;
    if (legProblem(current.arrival) || legProblem(current.departure)) return setError(c.errTimeDate);
    if (data?.required && !current.arrival.date) return setError(c.required);
    setBusy(true);
    setError(null);
    try {
      const res = await post<GuestTravel>("/guest/travel", travelBody(current.arrival, current.departure));
      qc.setQueryData(GUEST_TRAVEL_KEY, readGuestTravel(res));
      setDraft(null);
      leave.release();
      back();
      toast(c.saved);
    } catch (err) {
      // The server's own sentence for a date or time it refuses (EN and ES).
      setError(err instanceof ApiFailure && err.code === "bad_request" ? err.messages[lang] : failedText(c.saveFailed, err, lang));
    } finally {
      setBusy(false);
    }
  }

  const dock = data ? (
    <View style={{ gap: 8 }}>
      {error ? (
        <T v="meta13" color={colors.red} center accessibilityLiveRegion="polite" testID="travel-error">
          {error}
        </T>
      ) : null}
      <Button label={c.save} onPress={() => void save()} loading={busy} disabled={!online || busy} testID="travel-save" />
    </View>
  ) : undefined;

  return (
    <Screen query={q} header={<TopBar onBack={() => leave(back)} title={c.title} />} keyboard dock={dock}>
      <BigTitle title={c.title} sub={c.intro} size={34} />
      {q.isLoading && !data ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={220} r={18} />
          <Skeleton h={220} r={18} />
        </Stack>
      ) : !data && !q.isLoading && !q.isError ? (
        <View style={{ marginTop: 32 }}>
          <EmptyState title={c.title} body={c.intro} action={<Button label={common.back} kind="glass" small full={false} icon="back" onPress={back} />} />
        </View>
      ) : data ? (
        <Stack gap={16} style={{ marginTop: 18 }}>
          {data.required ? (
            <T v="meta13" color={colors.ivory55}>
              {c.required}
            </T>
          ) : null}
          <LegCard title={c.arrival} leg={current.arrival} points={data.points} weddingDate={data.wedding_date} onChange={(p) => setLeg("arrival", p)} testID="travel-arrival" />
          <LegCard title={c.departure} leg={current.departure} points={data.points} weddingDate={current.arrival.date ?? data.wedding_date} onChange={(p) => setLeg("departure", p)} testID="travel-departure" />
        </Stack>
      ) : null}
    </Screen>
  );
}

function LegCard({ title, leg, points, weddingDate, onChange, testID }: { title: string; leg: TravelLeg; points: { id: string; label: string }[]; weddingDate: string | null; onChange: (p: Partial<TravelLeg>) => void; testID: string }) {
  const c = useFeatureCopy(TRAVEL_COPY);
  const typed = !!leg.point && !isKnownPoint(leg.point, points);
  const [other, setOther] = useState(typed);
  return (
    <View testID={testID}>
      <Card kind="solid" padding={16}>
        <T v="title26" accessibilityRole="header">
          {title}
        </T>
        <Stack gap={14} style={{ marginTop: 12 }}>
          <Field label={c.date}>
            <DateInput label={`${title}, ${c.date}`} value={leg.date} onChange={(v) => onChange({ date: v })} initial={weddingDate} testID={`${testID}-date`} />
          </Field>
          <Field label={c.time}>
            <TimeInput label={`${title}, ${c.time}`} value={leg.time} onChange={(v) => onChange({ time: v })} testID={`${testID}-time`} />
          </Field>
          <Field label={c.point}>
            {points.length ? (
              <ChipRow>
                {points.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.label}
                    on={leg.point === p.id}
                    onPress={() => {
                      setOther(false);
                      onChange({ point: leg.point === p.id ? null : p.id });
                    }}
                  />
                ))}
                <Chip
                  label={c.pointOther}
                  on={other}
                  onPress={() => {
                    setOther(true);
                    if (isKnownPoint(leg.point, points)) onChange({ point: null });
                  }}
                />
              </ChipRow>
            ) : null}
            {other || !points.length ? (
              <Input accessibilityLabel={`${title}, ${c.point}`} value={isKnownPoint(leg.point, points) ? "" : leg.point ?? ""} onChangeText={(t) => onChange({ point: t.slice(0, 120) })} placeholder={c.pointPlaceholder} style={{ marginTop: points.length ? 8 : 0 }} />
            ) : null}
          </Field>
          <Field label={c.ref}>
            <Input accessibilityLabel={`${title}, ${c.ref}`} value={leg.ref ?? ""} onChangeText={(t) => onChange({ ref: t.replace(/[^A-Za-z0-9 ./-]/g, "").slice(0, 12) })} autoCapitalize="characters" autoCorrect={false} />
          </Field>
        </Stack>
      </Card>
    </View>
  );
}
