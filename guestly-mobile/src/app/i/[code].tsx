// Deep link landing: app.guest-ly.com/i/{code}?g={guestId}. With a guest id
// the session is minted directly (same trust as the personal RSVP link);
// without it the code is prefilled and the guest finds their name.

import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useSession, type TenantSummary, type GuestIdentity } from "@/lib/session";
import { Screen, Loading, T, Button, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export default function InviteLink() {
  const { code, g } = useLocalSearchParams<{ code: string; g?: string }>();
  const router = useRouter();
  const copy = useCopy();
  const { lang } = useLang();
  const { signInGuest } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const clean = (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (clean.length !== 6) {
        router.replace("/invite");
        return;
      }
      try {
        const opened = await post<{ tenant: TenantSummary }>("/auth/guest/open", { invite_code: clean });
        if (g && /^[0-9a-f-]{36}$/i.test(g)) {
          const r = await post<{ token: string; guest: GuestIdentity }>("/auth/guest/session", { invite_code: clean, guest_id: g });
          await signInGuest({ token: r.token, tenant: opened.tenant, guest: r.guest, inviteCode: clean });
          router.replace({ pathname: "/notify", params: { surface: "guest" } });
          return;
        }
        router.replace({ pathname: "/find", params: { code: clean, tenant: JSON.stringify(opened.tenant) } });
      } catch (err) {
        setError(err instanceof ApiFailure ? err.messages[lang] : copy.common.error);
      }
    })();
  }, [code, g, router, signInGuest, lang, copy]);

  return (
    <Screen bottomInset={24}>
      {error ? (
        <Stack gap={14} style={{ marginTop: 80 }}>
          <T v="title30">{error}</T>
          <Button label={copy.invite.open} onPress={() => router.replace("/invite")} />
        </Stack>
      ) : (
        <Loading label={copy.common.loading} />
      )}
      <T v="meta13" color={colors.ivory40} center style={{ marginTop: 24 }}>
        {copy.common.footerVersion}
      </T>
    </Screen>
  );
}
