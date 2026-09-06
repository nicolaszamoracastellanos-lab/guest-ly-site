// guestly://auth/callback?code=... (magic link, OAuth). Exchanges the code
// for a session; the SessionProvider's auth listener takes it from there.

import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCopy } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { Screen, Loading, T, Button, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string; error?: string }>();
  const router = useRouter();
  const copy = useCopy();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (params.error || !params.code) {
        setFailed(copy.signIn.linkExpiredTitle);
        return;
      }
      const { error } = await supabase().auth.exchangeCodeForSession(params.code);
      if (error) setFailed(copy.signIn.linkExpiredTitle);
      // On success the session listener routes to the surface.
    })();
  }, [params.code, params.error, copy]);

  return (
    <Screen bottomInset={24}>
      {failed ? (
        <Stack gap={14} style={{ marginTop: 120 }}>
          <T v="title34">{failed}</T>
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
