// Couples and planners: Sign in with Apple, Google (Supabase OAuth), emailed
// sign-in link by default, password as a fallback. The JWT is the only thing
// this screen produces; everything else comes from /auth/me.

import React, { useState } from "react";
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { useCopy, useLang } from "@/i18n";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { Screen, TopBar, LangToggle, Wordmark, T, Button, Input, Stack, Row, Hairline, SectionLabel } from "@/ui";
import { colors, FILL } from "@/ui/tokens";

WebBrowser.maybeCompleteAuthSession();
const suite = require("../../assets/photos/suite.jpg");

export default function SignIn() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : copy.common.error);
    } finally {
      setBusy(null);
    }
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error(copy.signIn.emailPlaceholder);
    const { error: e } = await supabase().auth.signInWithOtp({ email: clean, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
    if (e) throw e;
    setNote(copy.signIn.linkSent);
  }

  async function passwordSignIn() {
    const { error: e } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (e) throw e;
  }

  if (!supabaseConfigured()) {
    Alert.alert("Guest-ly", "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are not set.");
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} right={<LangToggle value={lang} onChange={setLang} />} />} bottomInset={24} padded={false} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hero}>
          <Image source={suite} style={FILL} resizeMode="cover" />
          <LinearGradient colors={["rgba(13,17,23,0.1)", "rgba(13,17,23,0.6)", colors.night]} style={FILL} />
        </View>
        <View style={{ paddingHorizontal: 28, marginTop: -180 }}>
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
          {Platform.OS === "ios" ? <Button label={copy.signIn.apple} kind="glass" icon="apple" onPress={() => withBusy("apple", apple)} loading={busy === "apple"} /> : null}
          <Button label={copy.signIn.google} kind="glass" icon="google" onPress={() => withBusy("google", google)} loading={busy === "google"} />
          <Row gap={12} style={{ marginVertical: 8 }}>
            <Hairline style={{ flex: 1 }} />
            <SectionLabel color={colors.ivory40}>{copy.signIn.orEmail}</SectionLabel>
            <Hairline style={{ flex: 1 }} />
          </Row>
          <Input icon="mail" value={email} onChangeText={setEmail} placeholder={copy.signIn.emailPlaceholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
          {usePassword ? (
            <Input icon="lock" value={password} onChangeText={setPassword} placeholder={copy.signIn.passwordPlaceholder} secureTextEntry textContentType="password" />
          ) : null}
          {usePassword ? (
            <Button label={copy.signIn.signInPassword} onPress={() => withBusy("pw", passwordSignIn)} loading={busy === "pw"} />
          ) : (
            <Button label={copy.signIn.sendLink} onPress={() => withBusy("link", magicLink)} loading={busy === "link"} />
          )}
          {note ? (
            <T v="body15" color={colors.greenText} center>
              {note}
            </T>
          ) : null}
          {error ? (
            <T v="body15" color={colors.red} center>
              {error}
            </T>
          ) : null}
          <T v="meta13" color={colors.ivory55} center style={{ marginTop: 4 }}>
            {usePassword ? "" : `${copy.signIn.noPassword} `}
            <T v="meta13" color={colors.goldLight} onPress={() => setUsePassword((v) => !v)}>
              {usePassword ? copy.signIn.sendLink : copy.signIn.usePassword}
            </T>
          </T>
        </Stack>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", height: 420, opacity: 0.55 },
});
