// Couples and planners: Sign in with Apple, Google (Supabase OAuth), emailed
// sign-in link by default, password as a fallback. The JWT is the only thing
// this screen produces; everything else comes from /auth/me.

import React, { useState } from "react";
import { View, StyleSheet, Image, Platform, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { useCopy, useLang } from "@/i18n";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { Screen, TopBar, LangToggle, Wordmark, T, Button, Input, Stack, Row, Hairline, SectionLabel } from "@/ui";
import { colors, FILL } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";

WebBrowser.maybeCompleteAuthSession();
const suite = require("../../assets/photos/suite.jpg");

export default function SignIn() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const back = useSafeBack();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = Linking.createURL("auth/callback");

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
    const e = (err ?? {}) as { message?: string; status?: number; code?: string; name?: string };
    const text = `${e.code ?? ""} ${e.message ?? ""} ${e.name ?? ""}`.toLowerCase();
    if (text.includes("err_request_canceled") || text.includes("cancel")) return null; // the person closed the Apple or Google sheet
    if (e.code === "gl_email_invalid") return copy.signIn.emailInvalid;
    if (e.status === 429 || text.includes("rate limit") || text.includes("too many")) return copy.signIn.errRate;
    if (text.includes("invalid login") || text.includes("invalid_credentials") || text.includes("invalid_grant")) return copy.signIn.errInvalid;
    if (text.includes("signups not allowed") || text.includes("user not found") || text.includes("otp_disabled")) return copy.signIn.errNoAccount;
    if (e.status === 0 || text.includes("network") || text.includes("fetch") || text.includes("timeout") || text.includes("offline")) return copy.signIn.errNetwork;
    return copy.signIn.errUnknown;
  }

  async function apple() {
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      nonce: hashed,
    });
    if (!cred.identityToken) throw new Error(copy.common.error);
    const { error: e } = await supabase().auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce });
    if (e) throw e;
  }

  async function google() {
    const { data, error: e } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (e || !data.url) throw e ?? new Error(copy.common.error);
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success") return;
    await exchangeFromUrl(res.url);
  }

  async function exchangeFromUrl(url: string) {
    const parsed = Linking.parse(url);
    const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
    if (code) {
      const { error: e } = await supabase().auth.exchangeCodeForSession(code);
      if (e) throw e;
      return;
    }
    // Implicit-flow fallback: tokens in the fragment.
    const frag = url.split("#")[1] ?? "";
    const p = new URLSearchParams(frag);
    const access = p.get("access_token");
    const refresh = p.get("refresh_token");
    if (access && refresh) {
      const { error: e } = await supabase().auth.setSession({ access_token: access, refresh_token: refresh });
      if (e) throw e;
    }
  }

  async function magicLink() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw Object.assign(new Error("email"), { code: "gl_email_invalid" });
    const { error: e } = await supabase().auth.signInWithOtp({ email: clean, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
    if (e) throw e;
    setNote(copy.signIn.linkSent);
  }

  async function passwordSignIn() {
    if (!email.trim() || !password) throw Object.assign(new Error("email"), { code: "gl_email_invalid" });
    const { error: e } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (e) throw e;
  }

  // A build without its sign-in settings says so calmly; it never names a setting.
  const configured = supabaseConfigured();
  const { height } = useWindowDimensions();
  // The photo is a share of the window, so on a 667 pt phone the email field
  // and the button are on screen without scrolling (Part 9 audit, D-035).
  const heroH = height < 700 ? 210 : Math.min(420, Math.round(height * 0.44));
  const overlap = Math.round(heroH * 0.44);

  return (
    <Screen header={<TopBar onBack={back} right={<LangToggle value={lang} onChange={setLang} />} />} bottomInset={24} padded={false} keyboard>
      <>
        <View style={[styles.hero, { height: heroH }]}>
          <Image source={suite} style={FILL} resizeMode="cover" />
          <LinearGradient colors={["rgba(13,17,23,0.1)", "rgba(13,17,23,0.6)", colors.night]} style={FILL} />
        </View>
        <View style={{ paddingHorizontal: 28, marginTop: -overlap }}>
          <Wordmark height={34} />
          <SectionLabel color={colors.goldLight} style={{ marginTop: 10 }}>
            {copy.signIn.label}
          </SectionLabel>
          <T v="title34" style={{ marginTop: 8 }}>
            {copy.signIn.title}
          </T>
          <T v="body15" color={colors.ivory55}>
            {copy.signIn.intro}
          </T>
        </View>
        <Stack gap={10} style={{ paddingHorizontal: 24, marginTop: 26 }}>
          {Platform.OS === "ios" ? <Button testID="signin-apple" label={copy.signIn.apple} kind="glass" icon="apple" onPress={() => withBusy("apple", apple)} loading={busy === "apple"} /> : null}
          <Button testID="signin-google" label={copy.signIn.google} kind="glass" icon="google" onPress={() => withBusy("google", google)} loading={busy === "google"} />
          <Row gap={12} style={{ marginVertical: 8 }}>
            <Hairline style={{ flex: 1 }} />
            <SectionLabel color={colors.ivory40}>{copy.signIn.orEmail}</SectionLabel>
            <Hairline style={{ flex: 1 }} />
          </Row>
          <Input testID="signin-email" icon="mail" value={email} onChangeText={setEmail} placeholder={copy.signIn.emailPlaceholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
          {usePassword ? (
            <Input testID="signin-password" icon="lock" value={password} onChangeText={setPassword} placeholder={copy.signIn.passwordPlaceholder} secureTextEntry textContentType="password" />
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
              setNote(null);
              setError(null);
            }}
            style={{ alignSelf: "center" }}
            full={false}
            haptic={false}
          />
        </Stack>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", opacity: 0.55 },
});
