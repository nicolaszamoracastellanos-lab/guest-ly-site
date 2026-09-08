// Invite code entry: six boxes, auto-advance, paste, uppercase.

import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import type { TenantSummary } from "@/lib/session";
import { Screen, TopBar, LangToggle, T, Button, Stack, SectionLabel } from "@/ui";
import { colors, radius, FILL } from "@/ui/tokens";

const suite = require("../../assets/photos/suite.jpg");
const LEN = 6;

export default function InviteCode() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? "").toUpperCase().slice(0, LEN));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (code.length === LEN) void open(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function open(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ tenant: TenantSummary }>("/auth/guest/open", { invite_code: value });
      router.push({ pathname: "/find", params: { code: value, tenant: JSON.stringify(r.tenant) } });
    } catch (err) {
      setError(err instanceof ApiFailure ? err.messages[lang] : copy.common.error);
    } finally {
      setBusy(false);
    }
  }

  const cells = Array.from({ length: LEN }, (_, i) => code[i] ?? "");
  return (
    <Screen header={<TopBar onBack={() => router.back()} right={<LangToggle value={lang} onChange={setLang} />} />} bottomInset={24} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <Image source={suite} style={FILL} resizeMode="cover" />
        </View>
        <Stack gap={8} style={{ marginTop: 28 }}>
          <SectionLabel color={colors.goldLight}>{copy.invite.label}</SectionLabel>
          <T v="title42" size={38}>
            {copy.invite.title}
          </T>
          <T v="body15" color={colors.ivory55}>
            {copy.invite.intro}
          </T>
        </Stack>
        <Pressable onPress={() => input.current?.focus()} style={styles.cells} accessibilityLabel={copy.invite.title}>
          {cells.map((c, i) => (
            <View key={i} style={[styles.cell, i === code.length && styles.cellActive]}>
              <T v="title30" size={32} color={colors.goldLight} style={{ fontFamily: "CormorantGaramond_600SemiBold" }}>
                {c}
              </T>
            </View>
          ))}
          <TextInput
            ref={input}
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, LEN))}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={LEN}
            style={styles.hidden}
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={() => code.length === LEN && open(code)}
          />
        </Pressable>
        {error ? (
          <T v="body15" color={colors.red} style={{ marginTop: 12 }}>
            {error}
          </T>
        ) : null}
        <Stack gap={14} style={{ marginTop: 28 }}>
          <Button label={copy.invite.open} onPress={() => open(code)} disabled={code.length !== LEN} loading={busy} />
          <T v="meta13" color={colors.ivory55} center>
            {copy.invite.noCode}
          </T>
        </Stack>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: "center", width: 150, height: 186, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.goldBorder, transform: [{ rotate: "-3deg" }], marginTop: 12 },
  cells: { flexDirection: "row", gap: 8, marginTop: 28 },
  cell: { flex: 1, height: 64, borderRadius: radius.chip, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", alignItems: "center", justifyContent: "center" },
  cellActive: { borderColor: "rgba(201,169,110,0.6)" },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
});
