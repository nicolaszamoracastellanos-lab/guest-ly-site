// Couples and planners: Sign in with Apple, Google (Supabase OAuth), emailed
// sign-in link by default, password as a fallback. The JWT is the only thing
// this screen produces; everything else comes from /auth/me. An account with
// no wedding yet (a new couple, a first Apple or Google sign-in) is routed to
// /setup by the session provider. New couples can also start at /sign-up.
//
// The emailed sign-in (build 13): one email from the portal with a link and an
// 8-digit code. After sending, this screen turns into "Check your email" with
// the code field, so the link is a shortcut, never the only way in (a mail
// app that drops the link, another device). The
// code step comes back by itself for 15 minutes if the app was closed while
// the person read their mail; /auth/callback opens it with ?step=code.

import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, TextInput, useWindowDimensions } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { Screen, TopBar, LangToggle, Wordmark, T, Button, Input, Stack, Row, Hairline, SectionLabel, PhotoHero, useKeyboardOpen, useTopInset } from "@/ui";
import { colors, fonts, radius } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { COPY as SIGNUP_COPY } from "@/features/signup/copy";
import {
  appleAvailable,
  authErrorKind,
  EMAIL_CODE_LENGTH,
  pendingEmailSignIn,
  LINK_VALID_MS,
  rememberEmailSignIn,
  sendEmailSignIn,
  signInWithApple,
  signInWithGoogle,
  verifyEmailCode,
} from "@/features/signup/social";

WebBrowser.maybeCompleteAuthSession();
const suite = require("../../assets/photos/suite.jpg");
// suite.jpg is 780 x 1386; the wax seal sits at 57% across, 71% down.
const SEAL = { w: 780, h: 1386, x: 0.57, y: 0.71 };
// Height of the back + language row under the status bar.
const BAR = 50;
// Seconds before "Resend the email" can be used again.
const RESEND_AFTER_S = 30;

/** Object position that puts the seal in the middle of the photo band left
 *  between the back row and the text (I4): the old centered crop showed the
 *  blank card and cut the envelope in half. */
function sealFocal(width: number, boxH: number, bandTop: number, bandBottom: number): { x: number; y: number } {
  const scale = Math.max(width / SEAL.w, boxH / SEAL.h);
  const imgH = SEAL.h * scale;
  const slack = imgH - boxH;
  if (!width || slack < 1) return { x: SEAL.x, y: 0.5 };
  const y = (SEAL.y * imgH - (bandTop + bandBottom) / 2) / slack;
  return { x: SEAL.x, y: Math.min(1, Math.max(0, y)) };
}

// The typed address outlives this screen: if it is remounted (a session
// event, a back and forth), or the person switches between link and password,
// they never have to type it again.
let rememberedEmail = "";

export default function SignIn() {
  const copy = useCopy();
  const su = useFeatureCopy(SIGNUP_COPY).signUp;
  const { lang, setLang } = useLang();
  const back = useSafeBack();
  const router = useRouter();
  // ?step=code (from /auth/callback "Type the code") opens the code step for
  // the last address; ?step=email is the form, prefilled.
  const { step } = useLocalSearchParams<{ step?: string }>();
  const [email, setEmailState] = useState(() => rememberedEmail);
  const setEmail = (v: string) => {
    rememberedEmail = v;
    setEmailState(v);
  };
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  // The code step: the address the email went to, the typed digits, and the
  // seconds left before a resend.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    let alive = true;
    // Sent here from the "link did not work" screen: the code is good for as
    // long as the link (an hour), not just the 15 minutes the step returns by itself.
    void pendingEmailSignIn(step === "code" ? LINK_VALID_MS : undefined).then((p) => {
      if (!alive || !p) return;
      if (!rememberedEmail) setEmail(p.email);
      if (step === "email") return;
      setSentTo(p.email);
      setWait(Math.max(0, RESEND_AFTER_S - Math.floor((Date.now() - p.at) / 1000)));
    });
    return () => {
      alive = false;
    };
    // Once per visit (or per step change from the callback screen).
  }, [step]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function withBusy(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      // Never the provider's raw English message (Part 9 audit, D-026).
      setError(signInMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function signInMessage(err: unknown): string | null {
    if ((err as { code?: string } | null)?.code === "gl_email_invalid") return copy.signIn.emailInvalid;
    switch (authErrorKind(err)) {
      case "cancel":
        return null; // the person closed the Apple or Google sheet
      case "signup_disabled":
        return su.errSocialNew;
      case "rate":
        return copy.signIn.errRate;
      case "invalid":
        return copy.signIn.errInvalid;
      case "no_account":
        return copy.signIn.errNoAccount;
      case "network":
        return copy.signIn.errNetwork;
      default:
        return copy.signIn.errUnknown;
    }
  }

  async function magicLink() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw Object.assign(new Error("email"), { code: "gl_email_invalid" });
    await sendEmailSignIn(clean, lang);
    setCode("");
    setSentTo(clean);
    setWait(RESEND_AFTER_S);
  }

  async function resend() {
    if (!sentTo || wait > 0) return;
    await sendEmailSignIn(sentTo, lang);
    setCode("");
    setWait(RESEND_AFTER_S);
    setNote(copy.signIn.resent);
    codeRef.current?.focus();
  }

  /** The 8 digits from the email. Runs by itself when the last digit lands
   *  (typed, pasted or offered by iOS from Mail). */
  async function submitCode(value: string) {
    if (!sentTo || busy || value.length !== EMAIL_CODE_LENGTH) return;
    setBusy("code");
    setError(null);
    setNote(null);
    try {
      await verifyEmailCode(sentTo, value);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // SIGNED_IN follows and the Gate moves the person on; the button keeps
      // its spinner until then (a second tap would spend nothing but show an
      // error). If nothing happens it comes back.
      setTimeout(() => setBusy((b) => (b === "code" ? null : b)), 15_000);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const kind = authErrorKind(err);
      setError(kind === "rate" ? copy.signIn.errRate : kind === "network" ? copy.signIn.errNetwork : copy.signIn.codeInvalid);
      setCode("");
      codeRef.current?.focus();
      setBusy(null);
    }
  }

  /** Back to the address field, typing intact. The pending record stays: the
   *  email already sent must still open the app if tapped later (a new send
   *  replaces it, a sign-in clears it). */
  function differentEmail() {
    setSentTo(null);
    setCode("");
    setNote(null);
    setError(null);
  }

  async function passwordSignIn() {
    if (!email.trim() || !password) throw Object.assign(new Error("email"), { code: "gl_email_invalid" });
    const { error: e } = await supabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (e) throw e;
    void rememberEmailSignIn(null);
  }

  // A build without its sign-in settings says so calmly; it never names a setting.
  const configured = supabaseConfigured();
  const { width, height } = useWindowDimensions();
  const top = useTopInset();
  // While typing, the photo shrinks to a band with the seal and only the
  // fields and the gold button stay, so the button is in view above the
  // keyboard on a 667 pt phone too (K7). Apple, Google and the intro come
  // back when the keyboard goes away.
  const keyboardOpen = useKeyboardOpen();
  // The photo is a share of the window, so on a 667 pt phone the email field
  // and the button are on screen without scrolling (Part 9 audit, D-035).
  // On a 6.1 to 6.9 inch phone the text starts as high on the photo as it
  // needs to for the whole form, down to "Create an account", to fit without
  // scrolling (at 240 pt the password switch was cut in half at the bottom
  // edge of a 17 Pro). 754 is the height of everything from the wordmark down.
  // The photo now runs edge to edge behind the status bar and the back row
  // (I4); the text starts where it started before, under that row.
  const compact = height < 700;
  const textTop = compact ? 118 : Math.max(118, Math.min(240, height - 754));
  const bandTop = top + BAR;
  const textStart = bandTop + (keyboardOpen ? 48 : textTop);
  const heroH = textStart + (keyboardOpen ? 56 : 110);
  const overlap = heroH - textStart;
  const codeStep = !usePassword && sentTo !== null;
  const cells = Array.from({ length: EMAIL_CODE_LENGTH }, (_, i) => code[i] ?? "");
  const activeCell = Math.min(code.length, EMAIL_CODE_LENGTH - 1);

  return (
    <Screen topInset={false} backdrop={false} bottomInset={24} padded={false} keyboard>
      <>
        <PhotoHero
          source={suite}
          height={heroH}
          focal={sealFocal(width, heroH, bandTop, textStart)}
          gradient={0.5}
          gutter={0}
          top={
            <View style={{ flex: 1 }}>
              <TopBar onBack={codeStep ? differentEmail : back} right={<LangToggle value={lang} onChange={setLang} />} />
            </View>
          }
        />
        <View style={{ paddingHorizontal: 28, marginTop: -overlap }}>
          {keyboardOpen ? null : <Wordmark height={34} />}
          <SectionLabel color={colors.goldLight} style={{ marginTop: keyboardOpen ? 0 : 10 }}>
            {codeStep ? copy.signIn.checkLabel : copy.signIn.label}
          </SectionLabel>
          <T v={keyboardOpen ? "title26" : "title34"} style={{ marginTop: 8 }}>
            {codeStep ? copy.signIn.checkTitle : copy.signIn.title}
          </T>
          {codeStep ? (
            // Always shown, keyboard up or not: it says where the email went.
            <T v="body15" color={colors.ivory55}>
              {fmt(copy.signIn.checkBody, { email: sentTo })}
            </T>
          ) : keyboardOpen ? null : (
            <T v="body15" color={colors.ivory55}>
              {copy.signIn.intro}
            </T>
          )}
        </View>
        {codeStep ? (
          <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: keyboardOpen ? 14 : 24 }}>
            {/* One hidden field under a row of cells (as in /sign-up/verify),
                so iOS can offer the code from Mail and a paste of the whole
                line works: only its digits are kept. */}
            <Pressable onPress={() => codeRef.current?.focus()} accessibilityRole="none" accessibilityLabel={copy.signIn.codeLabel}>
              <Row gap={6} style={{ justifyContent: "center" }}>
                {cells.map((d, i) => (
                  <View key={i} style={[styles.cell, d ? styles.cellFilled : null, i === activeCell && busy !== "code" ? styles.cellActive : null, error ? styles.cellError : null]}>
                    <T v="title30" size={26} color={colors.ivory} center style={{ fontFamily: fonts.displaySemibold }}>
                      {d}
                    </T>
                  </View>
                ))}
              </Row>
              <TextInput
                ref={codeRef}
                testID="signin-code"
                value={code}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
                  setCode(digits);
                  if (error) setError(null);
                  if (digits.length === EMAIL_CODE_LENGTH) void submitCode(digits);
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                caretHidden
                keyboardAppearance="dark"
                accessibilityLabel={copy.signIn.codeLabel}
                style={styles.hidden}
              />
            </Pressable>
            <Button
              testID="signin-code-submit"
              label={copy.signIn.codeSubmit}
              onPress={() => void submitCode(code)}
              loading={busy === "code"}
              disabled={code.length !== EMAIL_CODE_LENGTH}
              style={{ marginTop: 6 }}
            />
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
            {/* A fixed label: the countdown lives in the line under it. */}
            <Button
              testID="signin-resend"
              kind="text"
              small
              full={false}
              haptic={false}
              label={copy.signIn.resend}
              onPress={() => withBusy("resend", resend)}
              loading={busy === "resend"}
              disabled={wait > 0}
              style={{ alignSelf: "center" }}
            />
            {wait > 0 ? (
              <T v="meta13" color={colors.ivory40} center>
                {fmt(copy.signIn.resendIn, { s: wait })}
              </T>
            ) : null}
            {keyboardOpen ? null : (
              <T v="meta13" color={colors.ivory55} center>
                {copy.signIn.spam}
              </T>
            )}
            <Button testID="signin-different-email" kind="text" small full={false} haptic={false} label={copy.signIn.differentEmail} onPress={differentEmail} style={{ alignSelf: "center" }} />
          </Stack>
        ) : (
          <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: keyboardOpen ? 16 : 26 }}>
            {keyboardOpen ? null : (
              <>
                {appleAvailable ? (
                  <Button testID="signin-apple" label={copy.signIn.apple} kind="glass" icon="apple" onPress={() => withBusy("apple", signInWithApple)} loading={busy === "apple"} />
                ) : null}
                <Button testID="signin-google" label={copy.signIn.google} kind="glass" icon="google" onPress={() => withBusy("google", signInWithGoogle)} loading={busy === "google"} />
                <Row gap={12} style={{ marginVertical: 8 }}>
                  <Hairline style={{ flex: 1 }} />
                  <SectionLabel color={colors.ivory40}>{copy.signIn.orEmail}</SectionLabel>
                  <Hairline style={{ flex: 1 }} />
                </Row>
              </>
            )}
            <Input
              testID="signin-email"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder={copy.signIn.emailPlaceholder}
              accessibilityLabel={copy.signIn.emailLabel}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType={usePassword ? "next" : "send"}
              onSubmitEditing={() => (usePassword ? passwordRef.current?.focus() : void withBusy("link", magicLink))}
            />
            {usePassword ? (
              <Input
                ref={passwordRef}
                testID="signin-password"
                icon="lock"
                value={password}
                onChangeText={setPassword}
                placeholder={copy.signIn.passwordPlaceholder}
                accessibilityLabel={copy.signIn.passwordLabel}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void withBusy("pw", passwordSignIn)}
              />
            ) : null}
            {usePassword ? (
              <Button testID="signin-submit" label={copy.signIn.signInPassword} onPress={() => withBusy("pw", passwordSignIn)} loading={busy === "pw"} disabled={!configured} />
            ) : (
              <Button testID="signin-submit" label={copy.signIn.sendLink} onPress={() => withBusy("link", magicLink)} loading={busy === "link"} disabled={!configured} />
            )}
            {note ? (
              <T v="body15" color={colors.greenText} center>
                {note}
              </T>
            ) : null}
            {error || !configured ? (
              <T v="body15" color={colors.red} center accessibilityRole="alert">
                {configured ? error : copy.signIn.unavailable}
              </T>
            ) : null}
            {usePassword ? null : (
              <T v="meta13" color={colors.ivory55} center style={{ marginTop: 4 }}>
                {copy.signIn.noPassword}
              </T>
            )}
            {/* A real 44 pt button, not a 20 pt text link. Changing mode clears the
              "check your email" note and any error (Part 9 audit, D-040). */}
            <Button
              testID="signin-use-password"
              kind="text"
              small
              label={usePassword ? copy.signIn.sendLink : copy.signIn.usePassword}
              onPress={() => {
                setUsePassword((v) => !v);
                // Leaving password mode drops a typed password, so iOS does not
                // offer to save a password that was never accepted.
                setPassword("");
                setNote(null);
                setError(null);
              }}
              style={{ alignSelf: "center" }}
              full={false}
              haptic={false}
            />
            <Hairline style={{ marginTop: 10 }} />
            <Row gap={6} style={{ justifyContent: "center", flexWrap: "wrap" }}>
              <T v="body15" color={colors.ivory55}>
                {su.newHere}
              </T>
              <Button testID="signin-create" kind="text" small label={su.createLink} onPress={() => router.push("/sign-up")} full={false} haptic={false} />
            </Row>
          </Stack>
        )}
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    maxWidth: 46,
    height: 56,
    borderRadius: radius.tile - 4,
    borderWidth: 1,
    borderColor: colors.ivory14,
    backgroundColor: colors.glassSolidFill,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { borderColor: colors.ivory25 },
  cellActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(201,169,110,0.08)",
  },
  cellError: { borderColor: colors.red },
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    left: 0,
    top: 0,
  },
});
