// Create a couple account: Sign in with Apple, Google, or email + password
// with a code sent by email (/sign-up/verify). Planners never sign up here;
// agencies and Guest-ly create their accounts.
//
// Apple and Google go through the same calls as /sign-in: for a new person
// they create the account, and the session provider routes it to /setup.

import React, { useRef, useState } from "react";
import { View, StyleSheet, Image, Linking, useWindowDimensions, type TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { supabaseConfigured } from "@/lib/supabase";
import { useSafeBack } from "@/lib/nav";
import { Screen, TopBar, LangToggle, Wordmark, T, Button, Input, Stack, Row, Hairline, SectionLabel } from "@/ui";
import { colors, FILL } from "@/ui/tokens";
import { COPY } from "@/features/signup/copy";
import { startSignup } from "@/features/signup/api";
import { appleAvailable, authErrorKind, signInWithApple, signInWithGoogle } from "@/features/signup/social";

const photo = require("../../../assets/photos/courtyard.jpg");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUp() {
  const c = useFeatureCopy(COPY).signUp;
  const { lang, setLang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const configured = supabaseConfigured();

  const { height } = useWindowDimensions();
  const compact = height < 700;
  const heroH = compact ? Math.max(190, Math.round(height * 0.42) - 60) : 360;
  const overlap = heroH - (compact ? 110 : 210);

  async function run(key: "apple" | "google" | "email", fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  }

  function message(err: unknown): string | null {
    if (err instanceof ApiFailure) {
      if (err.code === "offline") return c.errNetwork;
      return err.messages[lang];
    }
    switch (authErrorKind(err)) {
      case "cancel":
        return null;
      case "signup_disabled":
        return c.errSocialNew;
      case "network":
        return c.errNetwork;
      default:
        return c.errUnknown;
    }
  }

  async function createWithEmail() {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError(c.errEmail);
      return;
    }
    if (password.length < 8) {
      setError(c.errPassword);
      passwordRef.current?.focus();
      return;
    }
    await startSignup(clean, password, lang);
    router.push("/sign-up/verify");
  }

  return (
    <Screen header={<TopBar onBack={back} right={<LangToggle value={lang} onChange={setLang} />} />} bottomInset={24} padded={false} keyboard>
      <>
        <View style={[styles.hero, { height: heroH }]}>
          <Image source={photo} style={FILL} resizeMode="cover" />
          <LinearGradient colors={["rgba(13,17,23,0.1)", "rgba(13,17,23,0.6)", colors.night]} style={FILL} />
        </View>
        <View style={{ paddingHorizontal: 28, marginTop: -overlap }}>
          <Wordmark height={34} />
          <SectionLabel color={colors.goldLight} style={{ marginTop: 10 }}>
            {c.label}
          </SectionLabel>
          <T v="title34" style={{ marginTop: 8 }}>
            {c.title}
          </T>
          <T v="body15" color={colors.ivory55}>
            {c.intro}
          </T>
        </View>
        <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 24 }}>
          {appleAvailable ? (
            <Button testID="signup-apple" label={c.apple} kind="glass" icon="apple" onPress={() => run("apple", signInWithApple)} loading={busy === "apple"} disabled={!configured} />
          ) : null}
          <Button testID="signup-google" label={c.google} kind="glass" icon="google" onPress={() => run("google", signInWithGoogle)} loading={busy === "google"} disabled={!configured} />
          <Row gap={12} style={{ marginVertical: 8 }}>
            <Hairline style={{ flex: 1 }} />
            <SectionLabel color={colors.ivory40}>{c.orEmail}</SectionLabel>
            <Hairline style={{ flex: 1 }} />
          </Row>
          <Input
            testID="signup-email"
            icon="mail"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            placeholder={c.emailPlaceholder}
            accessibilityLabel={c.emailLabel}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Input
            ref={passwordRef}
            testID="signup-password"
            icon="lock"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            placeholder={c.passwordPlaceholder}
            accessibilityLabel={c.passwordLabel}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            passwordRules="minlength: 8;"
            returnKeyType="go"
            onSubmitEditing={() => void run("email", createWithEmail)}
            right={
              <Button kind="text" small full={false} haptic={false} label={show ? c.hide : c.show} onPress={() => setShow((v) => !v)} />
            }
          />
          <Button testID="signup-submit" label={c.create} onPress={() => run("email", createWithEmail)} loading={busy === "email"} disabled={!configured} style={{ marginTop: 4 }} />
          {error ? (
            <T v="body15" color={colors.red} center accessibilityRole="alert">
              {error}
            </T>
          ) : null}
          <T v="meta13" color={colors.ivory55} center style={{ marginTop: 2 }}>
            {c.legal}
          </T>
          <Row gap={4} style={{ justifyContent: "center" }}>
            <Button kind="text" small full={false} haptic={false} label={c.terms} onPress={() => void Linking.openURL("https://guest-ly.com/terms")} />
            <Button kind="text" small full={false} haptic={false} label={c.privacy} onPress={() => void Linking.openURL("https://guest-ly.com/privacy")} />
          </Row>
          <Hairline style={{ marginTop: 6 }} />
          <Row gap={6} style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <T v="body15" color={colors.ivory55}>
              {c.haveAccount}
            </T>
            <Button testID="signup-signin" kind="text" small full={false} haptic={false} label={c.signIn} onPress={() => router.replace("/sign-in")} />
          </Row>
        </Stack>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", opacity: 0.55 },
});
