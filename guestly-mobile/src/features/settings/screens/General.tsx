// Settings > Wedding details (General): names, date, city, venue booked,
// time zone, guests' default language. Couple owner and admin edit (the web
// saveGeneralSettings validator runs on the server); viewers and planners
// read, with a one-line note. One Save in the top bar; leaving with changes
// asks first.

import React, { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useLang, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { Screen, TopBar, BigTitle, Stack, Field, Input, Segmented, ToggleRow, Card, Skeleton, T, Button, toast } from "@/ui";
import { DateInput } from "@/ui/Pickers";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import { GENERAL_KEY, useGeneralSettings, type GeneralSettings, type SettingsSurface } from "../hooks";
import { generalPatch, type GeneralDraft } from "../logic";
import { ZonePicker } from "../ZonePicker";
import { FieldError } from "../ui";

function toDraft(g: GeneralSettings): GeneralDraft {
  return { couple_names: g.couple_names, wedding_date: g.wedding_date, wedding_city: g.wedding_city, venue_booked: g.venue_booked, timezone: g.timezone, locale_default: g.locale_default };
}

export function GeneralScreen({ surface = "couple" }: { surface?: SettingsSurface }) {
  const c = useFeatureCopy(HH_COPY);
  const g = c.general;
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const query = useGeneralSettings(surface);
  const { data } = query;
  const [draft, setDraft] = useState<GeneralDraft | null>(null);
  const [seededFrom, setSeededFrom] = useState<GeneralSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Seed the form from the first answer (and again after a save).
  if (data && !seededFrom) {
    setSeededFrom(data);
    setDraft(toDraft(data));
  }
  const editable = !!data?.can_edit;
  const patch = data && draft ? generalPatch(toDraft(data), draft) : {};
  const dirty = editable && Object.keys(patch).length > 0;
  const leave = useUnsavedGuard(dirty);

  const set = <K extends keyof GeneralDraft>(k: K, v: GeneralDraft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      const saved = await post<GeneralSettings>(`/couple/settings/general`, patch);
      qc.setQueryData([...GENERAL_KEY, surface], saved);
      setSeededFrom(saved);
      setDraft(toDraft(saved));
      setErrors({});
      // Home and Settings read the names and the date.
      void qc.invalidateQueries({ queryKey: ["couple-home"] });
      void qc.invalidateQueries({ queryKey: ["couple-settings"] });
      toast(g.saved);
    } catch (err) {
      if (err instanceof ApiFailure && Object.keys(err.fields).length) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, m]) => [k, m[lang]])));
      } else toast(errorText(err, lang, c.common.error), { icon: "warning" });
    } finally {
      setBusy(false);
    }
  }

  const saveButton = editable ? <Button label={g.save} kind="text" small full={false} onPress={() => void save()} loading={busy} disabled={!dirty} testID="general-save" /> : undefined;

  return (
    <Screen query={query} header={<TopBar onBack={() => leave(back)} title={app.settings.title} right={saveButton} />} bottomInset={60} keyboard>
      <BigTitle title={g.title} sub={g.sub} size={38} />
      {!draft ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={76} />
          <Skeleton h={76} />
          <Skeleton h={76} />
        </Stack>
      ) : (
        <Stack gap={18} style={{ marginTop: 20 }}>
          {!editable ? (
            <T v="meta13" color={colors.amber}>
              {surface === "planner" ? g.readOnlyPlanner : g.readOnly}
            </T>
          ) : null}
          <Field label={g.names}>
            <Input value={draft.couple_names} onChangeText={(v) => set("couple_names", v)} placeholder={g.namesPlaceholder} placeholderTextColor={colors.ivory40} editable={editable} autoCapitalize="words" testID="general-names" />
            <FieldError text={errors.couple_names} />
          </Field>
          <Field label={g.date}>
            <DateInput value={draft.wedding_date} onChange={(v) => set("wedding_date", v)} placeholder={g.datePlaceholder} disabled={!editable} clearable label={g.date} />
            <FieldError text={errors.wedding_date} />
          </Field>
          <Field label={g.city}>
            <Input value={draft.wedding_city ?? ""} onChangeText={(v) => set("wedding_city", v)} placeholder={g.cityPlaceholder} placeholderTextColor={colors.ivory40} editable={editable} autoCapitalize="words" textContentType="addressCity" />
            <FieldError text={errors.wedding_city} />
          </Field>
          <Card kind="solid" padding={14}>
            <ToggleRow label={g.venue} hint={g.venueHint} value={draft.venue_booked} onChange={(v) => (editable ? set("venue_booked", v) : undefined)} />
          </Card>
          <Field label={g.timezone} hint={g.timezoneHint}>
            <ZonePicker value={draft.timezone} onChange={(tz) => set("timezone", tz)} disabled={!editable} label={g.timezone} />
            <FieldError text={errors.timezone} />
          </Field>
          <Field label={g.language} hint={g.languageHint}>
            <View pointerEvents={editable ? "auto" : "none"} style={!editable ? { opacity: 0.6 } : undefined}>
              <Segmented
                value={draft.locale_default}
                options={[
                  { value: "es", label: "Español" },
                  { value: "en", label: "English" },
                ]}
                onChange={(v) => set("locale_default", v)}
              />
            </View>
          </Field>
        </Stack>
      )}
    </Screen>
  );
}
