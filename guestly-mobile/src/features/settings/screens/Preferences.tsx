// Settings > Notifications: the preference center (GET/POST /me/prefs). One
// card per event with a switch per channel the event has (Email, Push,
// In-app); RSVP replies add Instant or Daily while the daily roundup is being
// sent; quiet hours; this phone (OS permission and the push kinds no server
// event covers: album, team); the tips switch (same as Profile). Each switch
// saves at once, optimistic, rolled back on failure. A Push switch also
// re-registers this phone's push prefs (lib/push) so the two never disagree.

import React, { useCallback, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { plural, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useSafeBack } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { loadPushPrefs, registerPush, savePushPrefs, PUSH_KEYS } from "@/lib/push";
import { Screen, TopBar, BigTitle, Stack, Card, ToggleRow, Toggle, Segmented, Skeleton, T, Row, Chip, EmptyState, SectionLabel, Button, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import { PREFS_KEY, PROFILE_KEY, usePrefs, type PrefChannel, type Prefs, type PrefsChange } from "../hooks";
import { applyPrefChange, devicePushPrefs, hourLabel, DEVICE_PUSH_KEY } from "../logic";

const QUIET_HOURS = Array.from({ length: 24 }, (_, i) => i);
const CHANNELS: PrefChannel[] = ["email", "push", "bell"];

export function PreferencesScreen() {
  const c = useFeatureCopy(HH_COPY);
  const p = c.prefs;
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const router = useRouter();
  const qc = useQueryClient();
  const query = usePrefs();
  const { data } = query;
  const { state, pushToken } = useSession();
  const surface = state.status === "user" && state.me.surface === "planner" ? "planner" : "couple";
  const [allWeddings, setAllWeddings] = useState(false);
  const [osPush, setOsPush] = useState<boolean | null>(null);
  const [device, setDevice] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (Platform.OS !== "web") {
        Notifications.getPermissionsAsync()
          .then((r) => alive && setOsPush(r.status === "granted"))
          .catch(() => {});
      }
      loadPushPrefs().then((v) => alive && setDevice(v));
      return () => {
        alive = false;
      };
    }, [])
  );

  // The phone's push prefs, kept equal to the Push cells and the phone-only kinds.
  async function syncDevice(next: Record<string, boolean>) {
    setDevice(next);
    await savePushPrefs(next);
    if (pushToken) await registerPush(surface, pushToken, next);
  }

  async function change(ch: PrefsChange) {
    if (!data) return;
    const prev = data;
    const scoped = allWeddings && !("marketing" in ch) ? { ...ch, scope: "all" as const } : ch;
    const optimistic = applyPrefChange(data, ch);
    qc.setQueryData<Prefs>(PREFS_KEY, optimistic);
    try {
      const fresh = await post<Prefs>("/me/prefs", scoped);
      qc.setQueryData(PREFS_KEY, fresh);
      if ("marketing" in ch) void qc.invalidateQueries({ queryKey: PROFILE_KEY });
      if ("channel" in ch && ch.channel === "push") await syncDevice(devicePushPrefs(surface, fresh.events, device));
    } catch (err) {
      qc.setQueryData(PREFS_KEY, prev);
      toast(errorText(err, lang, c.common.error), { icon: "warning" });
    }
  }

  const label = (ch: PrefChannel) => (ch === "email" ? p.email : ch === "push" ? p.push : p.bell);
  const driven = new Set(Object.values(DEVICE_PUSH_KEY[surface]));
  const phoneOnly = PUSH_KEYS[surface].filter((k) => !driven.has(k));
  const phoneLabels: Record<string, [string, string]> = {
    album: [app.notify.album, app.notify.albumDetail],
    team: [app.notify.team, app.notify.teamDetail],
  };

  return (
    <Screen query={query} header={<TopBar onBack={back} title={app.settings.title} />} bottomInset={60} refresh={() => query.refetch()}>
      <BigTitle title={p.title} sub={p.sub} size={38} />
      {!data ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={130} r={18} />
          <Skeleton h={130} r={18} />
        </Stack>
      ) : !data.available ? (
        <View style={{ marginTop: 20 }}>
          <EmptyState title={p.pending} />
        </View>
      ) : (
        <Stack gap={14} style={{ marginTop: 20 }}>
          {!data.can_edit ? (
            <T v="meta13" color={colors.amber}>
              {p.viewer}
            </T>
          ) : null}
          {data.can_edit && data.weddings_count > 1 ? (
            <Card kind="solid" padding={14}>
              <ToggleRow label={p.allWeddings} hint={plural(data.weddings_count, p.allWeddingsHint)} value={allWeddings} onChange={setAllWeddings} />
            </Card>
          ) : null}

          {data.can_edit
            ? data.events.map((e) => (
                <Card key={e.key} kind="solid" padding={16}>
                  <T v="body16">{e.label}</T>
                  {e.hint ? (
                    <T v="meta13" color={colors.ivory55} style={{ marginTop: 2 }}>
                      {e.hint}
                    </T>
                  ) : null}
                  <Row gap={8} style={{ marginTop: 12, flexWrap: "wrap" }}>
                    {CHANNELS.filter((ch) => e.channels[ch] !== undefined).map((ch) => (
                      <Row key={ch} gap={8} style={{ minHeight: 44, paddingRight: 10 }}>
                        <Toggle value={!!e.channels[ch]} onChange={(v) => void change({ event: e.key, channel: ch, enabled: v })} label={`${e.label}, ${label(ch)}`} />
                        <T v="meta13" color={colors.ivory70}>
                          {label(ch)}
                        </T>
                      </Row>
                    ))}
                  </Row>
                  {e.key === "rsvp_new" ? (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      <SectionLabel>{p.rsvpMode}</SectionLabel>
                      {data.daily_available ? (
                        <Segmented
                          value={data.rsvp_mode}
                          options={[
                            { value: "instant", label: p.instant },
                            { value: "daily", label: p.daily },
                          ]}
                          onChange={(mode) => void change({ event: "rsvp_new", mode })}
                        />
                      ) : (
                        <T v="meta13" color={colors.ivory55}>
                          {p.dailyOff}
                        </T>
                      )}
                    </View>
                  ) : null}
                </Card>
              ))
            : null}

          {data.can_edit ? (
            <>
              <SectionLabel style={{ marginTop: 8 }}>{p.quiet}</SectionLabel>
              <Card kind="solid" padding={16}>
                <ToggleRow label={p.quietOn} hint={p.quietHint} value={!!data.quiet_hours} onChange={(v) => void change({ quiet_hours: v ? { start: 22, end: 8 } : null })} />
                {data.quiet_hours ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    <HourRow label={p.from} value={data.quiet_hours.start} onPick={(h) => void change({ quiet_hours: { start: h, end: data.quiet_hours!.end } })} />
                    <HourRow label={p.to} value={data.quiet_hours.end} onPick={(h) => void change({ quiet_hours: { start: data.quiet_hours!.start, end: h } })} />
                  </View>
                ) : null}
              </Card>
            </>
          ) : null}

          {Platform.OS !== "web" ? (
            <>
              <SectionLabel style={{ marginTop: 8 }}>{p.phone}</SectionLabel>
              <Card kind="solid" padding={16}>
                <T v="meta13" color={colors.ivory55}>
                  {osPush === false || !pushToken ? p.phoneOff : p.phoneHint}
                </T>
                {osPush === false || !pushToken ? (
                  <Button label={p.phoneOn} kind="glass" small icon="bell" style={{ marginTop: 12 }} onPress={() => router.push({ pathname: "/notify", params: { surface, from: "settings" } } as never)} />
                ) : (
                  phoneOnly.map((k) =>
                    phoneLabels[k] ? (
                      <View key={k} style={{ marginTop: 10 }}>
                        <ToggleRow label={phoneLabels[k][0]} hint={phoneLabels[k][1]} value={device[k] !== false} onChange={(v) => void syncDevice({ ...device, [k]: v })} />
                      </View>
                    ) : null
                  )
                )}
              </Card>
            </>
          ) : null}

          <SectionLabel style={{ marginTop: 8 }}>{p.marketing}</SectionLabel>
          <Card kind="solid" padding={16}>
            <ToggleRow label={p.marketing} hint={p.marketingHint} value={data.marketing.consent} onChange={(v) => void change({ marketing: v })} />
          </Card>
        </Stack>
      )}
    </Screen>
  );
}

function HourRow({ label, value, onPick }: { label: string; value: number; onPick: (h: number) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label11" color={colors.goldLight}>
        {label}
      </T>
      {/* One scrolling line of hours, opened at the chosen one. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, value - 2) * 70, y: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
        {QUIET_HOURS.map((h) => (
          <Chip key={h} label={hourLabel(h)} on={h === value} onPress={() => onPick(h)} />
        ))}
      </ScrollView>
    </View>
  );
}
