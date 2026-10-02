// Invite code entry: six boxes, auto-advance, paste, uppercase.
//
// v1.2 (K8, B14, K18): the help line sits right under the boxes, before the
// button, and turns into the error when a code fails, so neither ever hides
// under the keyboard. A clear button empties the code in one tap (after an
// error the guest had to press delete six times). The keyboard no longer
// offers SMS one-time codes: they are digits, filled six at once, and failed.
//
// Build 12 (M2): "Continue" is docked and rides the keyboard (form screen),
// so it is never under the keys, on an iPhone SE either. A success haptic when
// the code opens a wedding; then one step (find your name) to the invitation.

import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Image, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { GUEST_COPY } from "@/features/guest/copy";
import { post } from "@/lib/api";
import type { TenantSummary } from "@/lib/session";
import { Screen, TopBar, LangToggle, T, Button, Stack, SectionLabel, Row, Icon, useKeyboardOpen } from "@/ui";
import { colors, fonts, radius, FILL } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { extractInviteCode } from "@/features/guest/format";
import { guestErrorText } from "@/features/guest/errors";

const suite = require("../../assets/photos/suite.jpg");
const LEN = 6;

export default function InviteCode() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang, setLang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => extractInviteCode(params.code ?? "", LEN));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInput>(null);
  // A ref, not the busy state: the auto-open effect and a tap on Open can
  // land in the same frame, before a re-render.
  const inFlight = useRef(false);

  useEffect(() => {
    if (code.length === LEN) void open(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function open(value: string) {
    if (inFlight.current || value.length !== LEN) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ tenant: TenantSummary }>("/auth/guest/open", { invite_code: value });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push({ pathname: "/find", params: { code: value, tenant: JSON.stringify(r.tenant) } });
    } catch (err) {
      setError(guestErrorText(err, copy, lang));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  // The keyboard opens by itself here. The photo card only shows when the window
  // is tall enough for the card, the title and the six boxes to sit above it;
  // otherwise the guest typed the code blind (Part 9 audit, D-002: every phone
  // up to 844 pt tall and both iPad windows). The card is small enough that the
  // Open button also clears the keyboard on a 956 pt Pro Max.
  const { height } = useWindowDimensions();
  const showCard = height >= 900;
  // On a short phone with the keyboard up, the label and the intro step aside
  // so the boxes, the help line and the button all stay above the keyboard.
  const keyboardOpen = useKeyboardOpen();
  const tight = keyboardOpen && height < 760;
  const clear = () => {
    setCode("");
    setError(null);
    input.current?.focus();
  };
  const cells = Array.from({ length: LEN }, (_, i) => code[i] ?? "");
  return (
    <Screen
      header={<TopBar onBack={back} right={<LangToggle value={lang} onChange={setLang} />} />}
      bottomInset={24}
      keyboard
      dock={<Button testID="invite-open" label={g.invite.continue} onPress={() => open(code)} disabled={code.length !== LEN} loading={busy} />}
    >
      <>
        {showCard ? (
          <View style={styles.card}>
            <Image source={suite} style={FILL} resizeMode="cover" />
          </View>
        ) : null}
        <Stack gap={8} style={{ marginTop: showCard ? 20 : 8 }}>
          {tight ? null : <SectionLabel color={colors.goldLight}>{copy.invite.label}</SectionLabel>}
          <T v="title42" size={height < 700 ? 32 : 38}>
            {copy.invite.title}
          </T>
          {tight ? null : (
            <T v="body15" color={colors.ivory55}>
              {copy.invite.intro}
            </T>
          )}
        </Stack>
        {/* VoiceOver reads the characters typed so far, one by one. */}
        <Pressable
          onPress={() => input.current?.focus()}
          style={styles.cells}
          accessibilityLabel={copy.invite.fieldLabel}
          accessibilityValue={{ text: code ? fmt(copy.invite.codeValue, { code: code.split("").join(" ") }) : copy.invite.codeEmpty }}
          accessibilityHint={copy.invite.intro}
        >
          {cells.map((c, i) => (
            <View key={i} style={[styles.cell, i === code.length && styles.cellActive]}>
              <T v="title30" size={32} color={colors.goldLight} style={{ fontFamily: fonts.displaySemibold }}>
                {c}
              </T>
            </View>
          ))}
          <TextInput
            testID="invite-input"
            ref={input}
            value={code}
            // No maxLength: iOS cut a paste such as "ABC-123" to five characters
            // before it could be cleaned. The six characters are picked here.
            onChangeText={(t) => {
              setCode(extractInviteCode(t, LEN));
              if (error) setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            style={styles.hidden}
            keyboardAppearance="dark"
            accessibilityLabel={copy.invite.fieldLabel}
            // Not oneTimeCode: QuickType offered the last SMS code (digits),
            // filled all six boxes and opened it at once, which always failed (K18).
            textContentType="none"
            autoComplete="off"
            spellCheck={false}
            returnKeyType="go"
            onSubmitEditing={() => code.length === LEN && open(code)}
          />
        </Pressable>
        {/* One line under the boxes: the help, or the error in its place. */}
        <Row gap={8} align="flex-start" style={{ marginTop: 12 }}>
          <T v={error ? "body15" : "meta13"} color={error ? colors.red : colors.ivory55} style={{ flex: 1, paddingTop: error ? 0 : 2 }} accessibilityLiveRegion="polite">
            {error ?? copy.invite.noCode}
          </T>
          {code ? (
            <Pressable testID="invite-clear" onPress={clear} accessibilityRole="button" accessibilityLabel={copy.invite.clear} hitSlop={8} style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}>
              <Icon name="x-circle" size={22} color={colors.ivory70} />
            </Pressable>
          ) : null}
        </Row>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: "center", width: 112, height: 138, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.goldBorder, transform: [{ rotate: "-3deg" }], marginTop: 12 },
  cells: { flexDirection: "row", gap: 8, marginTop: 22 },
  cell: { flex: 1, height: 64, borderRadius: radius.chip, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", alignItems: "center", justifyContent: "center" },
  cellActive: { borderColor: "rgba(201,169,110,0.6)" },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
  clear: { width: 44, height: 44, marginTop: -12, marginRight: -10, alignItems: "center", justifyContent: "center" },
});
