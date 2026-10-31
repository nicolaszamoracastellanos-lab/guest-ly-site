// Settings > Profile: first and last name, language (also the app's), time
// zone (the phone's own zone is pinned on top of the picker; saved only on
// Save), and the tips and product news consent (recorded with source "app",
// the same switch as in Notifications). Any signed-in login, couple or planner.

import React, { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useLang, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { Screen, TopBar, BigTitle, Stack, Field, Input, Segmented, ToggleRow, Card, Skeleton, T, Button, Row, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import { PREFS_KEY, PROFILE_KEY, useProfile, type Profile } from "../hooks";
import { ZonePicker } from "../ZonePicker";
import { FieldError } from "../ui";

type Draft = { first_name: string; last_name: string; lang: "en" | "es"; timezone: string };

const draftOf = (p: Profile): Draft => ({ first_name: p.first_name, last_name: p.last_name, lang: p.lang, timezone: p.timezone });

export function ProfileScreen() {
  const c = useFeatureCopy(HH_COPY);
  const p = c.profile;
  const app = useCopy();
  const { lang, setLang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const query = useProfile();
  const { data } = query;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  if (data && !draft) setDraft(draftOf(data));

  const changed: Partial<Draft> = {};
  if (data && draft) {
    const base = draftOf(data);
    (Object.keys(base) as (keyof Draft)[]).forEach((k) => {
      const v = typeof draft[k] === "string" ? draft[k].trim() : draft[k];
      if (v !== base[k]) (changed as Record<string, unknown>)[k] = v;
    });
  }
  const dirty = Object.keys(changed).length > 0;
  const leave = useUnsavedGuard(dirty);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      const saved = await post<Profile>("/me/profile", changed);
      qc.setQueryData(PROFILE_KEY, saved);
      setDraft(draftOf(saved));
      setErrors({});
      if (saved.lang !== lang) setLang(saved.lang);
      // Event labels in the preference center come in the saved language.
      void qc.invalidateQueries({ queryKey: PREFS_KEY });
      toast(p.saved);
    } catch (err) {
      if (err instanceof ApiFailure && Object.keys(err.fields).length) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, m]) => [k, m[lang]])));
      else toast(errorText(err, lang, c.common.error), { icon: "warning" });
    } finally {
      setBusy(false);
    }
  }

  // The consent switch saves at once (no Save needed), optimistic with rollback.
  async function setConsent(v: boolean) {
    if (!data || consentBusy) return;
    setConsentBusy(true);
    const prev = data;
    qc.setQueryData<Profile>(PROFILE_KEY, { ...data, marketing_consent: v, unsubscribed: v ? false : data.unsubscribed });
    try {
      const saved = await post<Profile>("/me/profile", { marketing_consent: v });
      qc.setQueryData(PROFILE_KEY, saved);
      void qc.invalidateQueries({ queryKey: PREFS_KEY });
    } catch (err) {
      qc.setQueryData(PROFILE_KEY, prev);
      toast(errorText(err, lang, c.common.error), { icon: "warning" });
    } finally {
      setConsentBusy(false);
    }
  }

  const saveButton = <Button label={p.save} kind="text" small full={false} onPress={() => void save()} loading={busy} disabled={!dirty} testID="profile-save" />;

  return (
    <Screen query={query} header={<TopBar onBack={() => leave(back)} title={app.settings.title} right={saveButton} />} bottomInset={60} keyboard>
      <BigTitle title={p.title} sub={p.sub} size={38} />
      {!draft || !data ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={76} />
          <Skeleton h={76} />
          <Skeleton h={120} />
        </Stack>
      ) : (
        <Stack gap={18} style={{ marginTop: 20 }}>
          <Row gap={12} align="flex-start">
            <View style={{ flex: 1 }}>
              <Field label={p.first}>
                <Input value={draft.first_name} onChangeText={(v) => set("first_name", v)} autoCapitalize="words" textContentType="givenName" autoComplete="given-name" testID="profile-first" />
                <FieldError text={errors.first_name} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={p.last}>
                <Input value={draft.last_name} onChangeText={(v) => set("last_name", v)} autoCapitalize="words" textContentType="familyName" autoComplete="family-name" />
                <FieldError text={errors.last_name} />
              </Field>
            </View>
          </Row>
          <Field label={p.email}>
            <T v="body16" color={colors.ivory70} selectable>
              {data.email}
            </T>
          </Field>
          <Field label={p.language} hint={p.languageHint}>
            <Segmented
              value={draft.lang}
              options={[
                { value: "es", label: "Español" },
                { value: "en", label: "English" },
              ]}
              onChange={(v) => set("lang", v)}
            />
            <FieldError text={errors.lang} />
          </Field>
          <Field label={p.timezone} hint={p.timezoneHint}>
            <ZonePicker value={draft.timezone} onChange={(tz) => set("timezone", tz)} label={p.timezone} />
            <FieldError text={errors.timezone} />
          </Field>
          <Card kind="solid" padding={14}>
            <ToggleRow label={p.marketing} hint={p.marketingHint} value={data.marketing_consent} onChange={(v) => void setConsent(v)} />
            {data.unsubscribed && !data.marketing_consent ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
                {p.unsubscribed}
              </T>
            ) : null}
          </Card>
        </Stack>
      )}
    </Screen>
  );
}
