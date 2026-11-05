// Apple 5.1.2(i) consent sheet. A screen that is about to send personal data
// to an AI provider calls `ask(scope)` first; the sheet opens only for what
// this person has not allowed yet (core.ts missingScopes) and resolves true
// when they allow, false when they decline or close it. Declining sends
// nothing and costs nothing: the next use simply asks again.
//
//   const consent = useAiConsentGate();
//   if (!(await consent.ask("coordinator"))) return;   // before the first send
//   ...
//   return <>{screen}{consent.sheet}</>;
//
// The sheet is the kit's Sheet (a native modal with its own toast host), so it
// works over a tab, a pushed screen or another modal.

import React, { useCallback, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeatureCopy } from "@/i18n/feature";
import { useUserSession } from "@/lib/session";
import { registerScopedReset } from "@/lib/scope";
import { Button, Icon, Row, Sheet, Stack, T, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { consentKey, missingScopes, parseConsent, withConsent, type ConsentRecord, type ConsentScope } from "./core";
import { CONSENT_COPY } from "./copy";

const memory = new Map<string, ConsentRecord>();

async function readRecord(userId: string): Promise<ConsentRecord> {
  const cached = memory.get(userId);
  if (cached) return cached;
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(consentKey(userId));
  } catch {
    raw = null;
  }
  const rec = parseConsent(raw);
  memory.set(userId, rec);
  return rec;
}

async function writeRecord(userId: string, rec: ConsentRecord): Promise<void> {
  memory.set(userId, rec);
  try {
    await AsyncStorage.setItem(consentKey(userId), JSON.stringify(rec));
  } catch {
    // Kept in memory for this run; the next launch asks again. Never sends without a yes.
  }
}

/** Sign-out deletes the stored answers (gl.scoped. prefix); this forgets the memory copy too. */
export function forgetConsentMemory() {
  memory.clear();
}
registerScopedReset(forgetConsentMemory);

type Pending = { scopes: ConsentScope[]; index: number; resolve: (ok: boolean) => void };

export function useAiConsentGate() {
  const userId = useUserSession()?.me.user.id ?? null;
  const c = useFeatureCopy(CONSENT_COPY);
  const [pending, setPendingState] = useState<Pending | null>(null);
  // Read by handlers that fire before a re-render (a double tap on Allow).
  const pendingRef = useRef<Pending | null>(null);
  const setPending = (p: Pending | null) => {
    pendingRef.current = p;
    setPendingState(p);
  };

  const ask = useCallback(
    async (scope: ConsentScope): Promise<boolean> => {
      if (!userId) return false;
      if (pendingRef.current) return false;
      const missing = missingScopes(await readRecord(userId), scope);
      if (!missing.length) return true;
      return new Promise<boolean>((resolve) => setPending({ scopes: missing, index: 0, resolve }));
    },
    [userId]
  );

  const finish = (ok: boolean) => {
    const p = pendingRef.current;
    if (!p) return;
    setPending(null);
    if (!ok) toast(c.notSent, { icon: "info" });
    p.resolve(ok);
  };

  const allow = async () => {
    const p = pendingRef.current;
    if (!p || !userId) return;
    const scope = p.scopes[p.index];
    await writeRecord(userId, withConsent(await readRecord(userId), [scope], new Date().toISOString()));
    if (p.index + 1 < p.scopes.length) setPending({ ...p, index: p.index + 1 });
    else finish(true);
  };

  const scope = pending ? pending.scopes[pending.index] : null;
  const s = scope ? c[scope] : null;
  const sheet = (
    <Sheet
      visible={!!pending}
      onClose={() => finish(false)}
      top={110}
      form={false}
      // Allow and Not now stay in view at every text size; the details scroll above them.
      footer={
        s ? (
          <Stack gap={10}>
            <Button label={c.allow} onPress={() => void allow()} testID="consent-allow" />
            <Button label={c.decline} kind="ghost" onPress={() => finish(false)} testID="consent-decline" />
          </Stack>
        ) : undefined
      }
    >
      {s ? (
        <Stack gap={16} style={{ paddingBottom: 8 }}>
          <View testID={`consent-${scope}`}>
            <T v="title26">{s.title}</T>
            <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
              {s.intro}
            </T>
          </View>
          <ConsentRow icon="globe" label={c.sentTo} text={s.who} />
          <ConsentRow icon="mail" label={c.whatIsSent} text={s.what} />
          <ConsentRow icon="info" label={c.whatFor} text={s.why} />
          {/* A plain link in ivory: the sheet's one gold is Allow and continue. */}
          <Pressable accessibilityRole="link" accessibilityLabel={c.privacy} onPress={() => void Linking.openURL("https://guest-ly.com/privacy").catch(() => {})} hitSlop={10} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
            <T v="body15" color={colors.ivory70} style={{ textDecorationLine: "underline" }}>
              {c.privacy}
            </T>
          </Pressable>
        </Stack>
      ) : null}
    </Sheet>
  );

  return { ask, sheet, open: !!pending };
}

function ConsentRow({ icon, label, text }: { icon: "globe" | "mail" | "info"; label: string; text: string }) {
  return (
    <Row gap={12} align="flex-start">
      <View style={{ paddingTop: 2 }}>
        <Icon name={icon} size={20} color={colors.ivory55} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body15" color={colors.ivory}>
          {label}
        </T>
        <T v="body15" color={colors.ivory70}>
          {text}
        </T>
      </View>
    </Row>
  );
}
