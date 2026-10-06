// Where an emailed sign-in link (and, on Android, a Google round trip) comes
// back: guestly://auth/callback or the universal link
// https://app.guest-ly.com/auth/app/callback. app/+native-intent keeps the
// full URL (with the #fragment that carries the tokens of the emailed link)
// and routes here; a PKCE ?code= and a ?token_hash= are handled too. On
// success the session provider's listener takes over and the root Gate moves
// the person on ("auth" counts as an entrance there), to /setup for a new
// couple account.
//
// A code can only be exchanged once. When the same link arrives twice (the
// in-app browser and the deep link on Android), the second exchange fails
// while the first already signed the person in: a live session is success,
// never "link expired". If nothing has moved the person on after 15 seconds,
// the screen offers the code from the email or a new link instead of spinning.

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useCopy } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { completeAuthFromUrl, isAuthReturnUrl, peekPendingAuthUrl, subscribePendingAuthUrl } from "@/features/signup/social";
import { Screen, Loading, T, Button, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

const handled = new Set<string>();
const GIVE_UP_MS = 15_000;
const NO_URL_MS = 4_000;

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string }>();
  const kept = useSyncExternalStore(subscribePendingAuthUrl, peekPendingAuthUrl);
  const incoming = Linking.useURL();
  const router = useRouter();
  const copy = useCopy();
  // Failure belongs to one URL: a newer link starts a fresh try.
  const [failedFor, setFailedFor] = useState<string | null>(null);

  // The URL kept by +native-intent first; then the system's URL; then the
  // route params when the router opened this screen without either.
  const fromParams = params.code
    ? `guestly://auth/callback?code=${encodeURIComponent(params.code)}`
    : params.error || params.error_code
      ? `guestly://auth/callback?error=${encodeURIComponent(params.error_code ?? params.error ?? "error")}`
      : null;
  const url = kept ?? (isAuthReturnUrl(incoming) ? incoming : null) ?? fromParams;
  const failed = failedFor === (url ?? "");

  useEffect(() => {
    if (!url) {
      // Nothing to finish yet; the URL may still be arriving.
      const t = setTimeout(() => setFailedFor(""), NO_URL_MS);
      return () => clearTimeout(t);
    }
    // Success unmounts this screen (the Gate moves the person on). Still here
    // after the wait: the link was spent, expired, or the session never came.
    const giveUp = setTimeout(() => setFailedFor(url), GIVE_UP_MS);
    if (handled.has(url)) return () => clearTimeout(giveUp);
    handled.add(url);
    let cancelled = false;
    (async () => {
      try {
        await completeAuthFromUrl(url);
      } catch {
        const { data } = await supabase()
          .auth.getSession()
          .catch(() => ({ data: { session: null } }));
        if (!cancelled && !data.session) setFailedFor(url);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
  }, [url]);

  return (
    <Screen bottomInset={24}>
      {failed ? (
        <Stack gap={14} style={{ marginTop: 120 }}>
          <T v="title34">{copy.signIn.linkFailedTitle}</T>
          <T v="body15" color={colors.ivory55}>
            {copy.signIn.linkFailedBody}
          </T>
          <Button testID="auth-enter-code" label={copy.signIn.enterCode} onPress={() => router.replace({ pathname: "/sign-in", params: { step: "code" } })} />
          <Button testID="auth-send-new" label={copy.signIn.sendNew} kind="ghost" onPress={() => router.replace({ pathname: "/sign-in", params: { step: "email" } })} />
        </Stack>
      ) : (
        <Loading label={copy.common.loading} />
      )}
    </Screen>
  );
}
