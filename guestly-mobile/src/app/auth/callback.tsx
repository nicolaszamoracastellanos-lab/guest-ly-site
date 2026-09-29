// guestly://auth/callback: where an emailed sign-in link (and, on Android, a
// Google round trip) comes back. With the PKCE flow (lib/supabase) it carries
// ?code=, which is exchanged for a session; older links may still carry the
// tokens in the #fragment, which is handled too. On success the session
// provider's listener takes over and the root Gate moves the person on
// ("auth" counts as an entrance there), to /setup for a new couple account.
//
// A code can only be exchanged once. When the same link arrives twice (the
// in-app browser and the deep link on Android), the second exchange fails
// while the first already signed the person in: a live session is success,
// never "link expired".

import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useCopy } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { completeAuthFromUrl } from "@/features/signup/social";
import { Screen, Loading, T, Button, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

const handled = new Set<string>();

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string }>();
  const incoming = Linking.useURL();
  const router = useRouter();
  const copy = useCopy();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Prefer the full incoming URL (it keeps the #fragment); fall back to the
    // route params when the router opened this screen without one.
    const fromParams = params.code
      ? `guestly://auth/callback?code=${encodeURIComponent(params.code)}`
      : params.error || params.error_code
        ? `guestly://auth/callback?error=${encodeURIComponent(params.error_code ?? params.error ?? "error")}`
        : null;
    const url = incoming && incoming.includes("auth/callback") ? incoming : fromParams;
    if (!url) {
      // Nothing to exchange yet; the URL may still be arriving.
      const t = setTimeout(() => setFailed(true), 4000);
      return () => clearTimeout(t);
    }
    if (handled.has(url)) return;
    handled.add(url);
    let cancelled = false;
    (async () => {
      try {
        await completeAuthFromUrl(url);
      } catch {
        const { data } = await supabase().auth.getSession();
        if (!cancelled && !data.session) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incoming, params.code, params.error, params.error_code]);

  return (
    <Screen bottomInset={24}>
      {failed ? (
        <Stack gap={14} style={{ marginTop: 120 }}>
          <T v="title34">{copy.signIn.linkExpiredTitle}</T>
          <T v="body15" color={colors.ivory55}>
            {copy.signIn.linkExpiredBody}
          </T>
          <Button label={copy.signIn.sendNew} onPress={() => router.replace("/sign-in")} />
          <Button label={copy.signIn.differentEmail} kind="ghost" onPress={() => router.replace("/sign-in")} />
        </Stack>
      ) : (
        <Loading label={copy.common.loading} />
      )}
    </Screen>
  );
}
