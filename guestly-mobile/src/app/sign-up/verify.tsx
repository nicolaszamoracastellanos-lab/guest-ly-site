// Confirm the email of a new couple account with the code we sent. One
// hidden text field under a row of cells, so iOS can offer the code from Mail
// ("From Mail") and paste works. Submits by itself when the last digit lands.
// A correct code signs the person in; the session provider then takes the
// account to /setup.

import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useSafeBack } from "@/lib/nav";
import { Screen, TopBar, LangToggle, T, Button, Stack, SectionLabel, Row, Gem } from "@/ui";
import { colors, fonts, radius } from "@/ui/tokens";
import { COPY } from "@/features/signup/copy";
import { confirmCode, getSignupDraft, startSignup } from "@/features/signup/api";
import { authErrorKind } from "@/features/signup/social";

const RESEND_AFTER_S = 45;

export default function VerifyEmail() {
  const c = useFeatureCopy(COPY).verify;
  const { lang, setLang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  // Read once: the draft is replaced by a resend, never cleared under us.
  const [draft, setDraft] = useState(() => getSignupDraft());
  const length = draft?.codeLength ?? 8;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const input = useRef<TextInput>(null);

  // No draft means this screen was opened cold (a restart): start over.
  useEffect(() => {
    if (!draft) router.replace("/sign-up");
  }, [draft, router]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(value: string) {
    if (!draft || busy || value.length !== length) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await confirmCode(draft.email, value);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // SIGNED_IN follows; the Gate moves the new account to /setup.
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const kind = authErrorKind(err);
      setError(kind === "rate" ? c.errRate : kind === "network" ? c.errNetwork : c.errCode);
      setCode("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!draft || resending || wait > 0) return;
    setResending(true);
    setError(null);
    setNote(null);
    try {
      await startSignup(draft.email, draft.password, draft.lang);
      setDraft(getSignupDraft());
      setNote(c.resent);
      setWait(RESEND_AFTER_S);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiFailure ? (err.code === "offline" ? c.errNetwork : err.messages[lang]) : c.errNetwork);
    } finally {
      setResending(false);
    }
  }

  const cells = Array.from({ length }, (_, i) => code[i] ?? "");
  const active = Math.min(code.length, length - 1);

  return (
    <Screen header={<TopBar onBack={back} right={<LangToggle value={lang} onChange={setLang} />} />} bottomInset={24} keyboard>
      <Stack gap={10} style={{ marginTop: 18 }}>
        <Gem size={14} />
        <SectionLabel color={colors.goldLight}>{c.label}</SectionLabel>
        <T v="title34">{c.title}</T>
        <T v="body15" color={colors.ivory55}>
          {fmt(c.intro, { email: draft?.email ?? "" })}
        </T>
      </Stack>

      <Pressable
        onPress={() => input.current?.focus()}
        accessibilityRole="none"
        accessibilityLabel={c.codeLabel}
        style={{ marginTop: 30 }}
      >
        <Row gap={length > 6 ? 6 : 10} style={{ justifyContent: "center" }}>
          {cells.map((d, i) => (
            <View
              key={i}
              style={[
                styles.cell,
                { flex: 1, maxWidth: 48 },
                d ? styles.cellFilled : null,
                i === active && !busy ? styles.cellActive : null,
                error ? styles.cellError : null,
              ]}
            >
              <T v="title30" size={28} color={colors.ivory} center style={{ fontFamily: fonts.displaySemibold }}>
                {d}
              </T>
            </View>
          ))}
        </Row>
        <TextInput
          ref={input}
          testID="verify-code"
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, length);
            setCode(digits);
            if (error) setError(null);
            if (digits.length === length) void submit(digits);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus
          caretHidden
          keyboardAppearance="dark"
          accessibilityLabel={c.codeLabel}
          style={styles.hidden}
        />
      </Pressable>

      <Stack gap={10} style={{ marginTop: 26 }}>
        <Button testID="verify-submit" label={c.confirm} onPress={() => void submit(code)} loading={busy} disabled={code.length !== length} />
        {error ? (
          <T v="body15" color={colors.red} center accessibilityRole="alert">
            {error}
          </T>
        ) : null}
        {note ? (
          <T v="body15" color={colors.greenText} center accessibilityRole="alert">
            {note}
          </T>
        ) : null}
        {/* A fixed label: a countdown inside the button made the label
            re-fit every second and shrink to an unreadable size. */}
        <Button testID="verify-resend" kind="text" small full={false} haptic={false} label={c.resend} onPress={() => void resend()} loading={resending} disabled={wait > 0} style={{ alignSelf: "center" }} />
        {wait > 0 ? (
          <T v="meta13" color={colors.ivory40} center>
            {fmt(c.resendIn, { s: wait })}
          </T>
        ) : null}
        <T v="meta13" color={colors.ivory55} center>
          {c.spam}
        </T>
        <Button kind="text" small full={false} haptic={false} label={c.changeEmail} onPress={() => router.replace("/sign-up")} style={{ alignSelf: "center" }} />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cell: {
    height: 58,
    borderRadius: radius.tile - 4,
    borderWidth: 1,
    borderColor: colors.ivory14,
    backgroundColor: colors.glassSolidFill,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { borderColor: colors.ivory25 },
  cellActive: { borderColor: colors.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  cellError: { borderColor: colors.red },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0.01, left: 0, top: 0 },
});
