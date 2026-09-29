// Wedding setup for a new couple account (session state "onboarding"): the
// two names, the date, the city and country, the guests' language. Creates
// the wedding, locked until it is activated, and the Gate moves on to the
// "almost ready" home (/pending).

import React, { useEffect, useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useSession } from "@/lib/session";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { Screen, TopBar, LangToggle, T, Button, Input, Stack, Field, Segmented, SectionLabel, Gem, Row } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/signup/copy";
import { clearSignupDraft, createWedding } from "@/features/signup/api";
import { takeSocialGivenName } from "@/features/signup/social";
import { DateField } from "@/features/signup/DateField";

export default function Setup() {
  const c = useFeatureCopy(COPY).setup;
  const { lang, setLang } = useLang();
  const { state, refreshMe, signOut } = useSession();
  const email = state.status === "onboarding" ? state.email : "";
  // Apple sends the first name only on the first authorization; use it.
  const [partner1, setPartner1] = useState(() => takeSocialGivenName() ?? "");
  const [partner2, setPartner2] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [guestLang, setGuestLang] = useState<"en" | "es">(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partnerRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);

  // The password typed at signup is no longer needed.
  useEffect(() => clearSignupDraft(), []);

  // Otherwise start with the first name Google (or Apple, earlier) stored.
  useEffect(() => {
    if (!supabaseConfigured()) return;
    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        const meta = (data.session?.user.user_metadata ?? {}) as Record<string, unknown>;
        const raw = (typeof meta.given_name === "string" && meta.given_name) || (typeof meta.full_name === "string" && meta.full_name) || (typeof meta.name === "string" && meta.name) || "";
        const first = raw.trim().split(/\s+/)[0] ?? "";
        if (first && first.length <= 40) setPartner1((v) => v || first);
      })
      .catch(() => {});
  }, []);

  async function submit() {
    if (busy) return;
    const p1 = partner1.trim();
    const p2 = partner2.trim();
    if (!p1 || !p2) {
      setError(c.errNames);
      return;
    }
    if (!city.trim()) {
      setError(c.errCity);
      cityRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createWedding({ partner1: p1, partner2: p2, wedding_date: date, city: city.trim(), country: country.trim() || null, lang: guestLang });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshMe(); // onboarding -> user (locked); the Gate opens /pending
    } catch (err) {
      if (err instanceof ApiFailure) {
        setError(err.code === "not_eligible" ? c.errNotEligible : err.code === "offline" || err.code === "server_error" ? c.errUnknown : err.messages[lang]);
      } else {
        setError(c.errUnknown);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar right={<LangToggle value={lang} onChange={setLang} />} />} bottomInset={32} keyboard>
      <Stack gap={10} style={{ marginTop: 10 }}>
        <Gem size={14} />
        <SectionLabel color={colors.goldLight}>{c.label}</SectionLabel>
        <T v="title34">{c.title}</T>
        <T v="body15" color={colors.ivory55}>
          {c.intro}
        </T>
      </Stack>

      <Stack gap={16} style={{ marginTop: 26 }}>
        <Row gap={10} align="flex-end">
          <Field label={c.you} style={{ flex: 1 }}>
            <Input
              testID="setup-partner1"
              value={partner1}
              onChangeText={setPartner1}
              placeholder={c.youPlaceholder}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              maxLength={60}
              returnKeyType="next"
              onSubmitEditing={() => partnerRef.current?.focus()}
            />
          </Field>
          <Field label={c.partner} style={{ flex: 1 }}>
            <Input
              ref={partnerRef}
              testID="setup-partner2"
              value={partner2}
              onChangeText={setPartner2}
              placeholder={c.partnerPlaceholder}
              autoCapitalize="words"
              autoComplete="off"
              maxLength={60}
              returnKeyType="next"
              onSubmitEditing={() => cityRef.current?.focus()}
            />
          </Field>
        </Row>
        {partner1.trim() && partner2.trim() ? (
          <T v="title26" color={colors.goldLight} center numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {`${partner1.trim()} & ${partner2.trim()}`}
          </T>
        ) : null}
        <Field label={c.date}>
          <DateField testID="setup-date" value={date} onChange={setDate} label={c.date} placeholder={c.dateTbd} />
        </Field>
        <Row gap={10} align="flex-end">
          <Field label={c.city} style={{ flex: 1 }}>
            <Input
              ref={cityRef}
              testID="setup-city"
              value={city}
              onChangeText={setCity}
              placeholder={c.cityPlaceholder}
              autoCapitalize="words"
              textContentType="addressCity"
              maxLength={80}
              returnKeyType="next"
              onSubmitEditing={() => countryRef.current?.focus()}
            />
          </Field>
          <Field label={c.country} style={{ flex: 1 }}>
            <Input
              ref={countryRef}
              testID="setup-country"
              value={country}
              onChangeText={setCountry}
              placeholder={c.countryPlaceholder}
              autoCapitalize="words"
              textContentType="countryName"
              maxLength={60}
              returnKeyType="done"
            />
          </Field>
        </Row>
        <Field label={c.language}>
          <Segmented
            value={guestLang}
            options={[
              { value: "en", label: c.english },
              { value: "es", label: c.spanish },
            ]}
            onChange={setGuestLang}
          />
        </Field>
      </Stack>

      <Stack gap={10} style={{ marginTop: 28 }}>
        <Button testID="setup-submit" label={c.create} onPress={() => void submit()} loading={busy} />
        {error ? (
          <T v="body15" color={colors.red} center accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        <View style={{ alignItems: "center", marginTop: 10, gap: 2 }}>
          <T v="meta13" color={colors.ivory40} center>
            {fmt(c.signedInAs, { email })}
          </T>
          <Button kind="text" small full={false} haptic={false} label={c.signOut} onPress={() => void signOut()} style={{ alignSelf: "center" }} />
        </View>
      </Stack>
    </Screen>
  );
}
