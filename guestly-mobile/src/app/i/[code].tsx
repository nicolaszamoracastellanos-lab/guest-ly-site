// Deep link landing: app.guest-ly.com/i/{code}?g={guestId}. With a guest id
// the session is minted directly (same trust as the personal RSVP link);
// without it the code is prefilled and the guest finds their name.
//
// Runs once per link. Signing in can switch the language (a phone set to a
// third language takes the wedding's), which re-created `copy` and re-ran the
// old effect: two opens, two sessions, two navigations.

import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useSession, type TenantSummary, type GuestIdentity } from "@/lib/session";
import { Screen, Loading, T, Button, Stack } from "@/ui";
import { colors } from "@/ui/tokens";
import { extractInviteCode } from "@/features/guest/format";
import { guestErrorText } from "@/features/guest/errors";

export default function InviteLink() {
  const { code, g } = useLocalSearchParams<{ code: string; g?: string }>();
  const router = useRouter();
  const copy = useCopy();
  const { lang } = useLang();
  const { state, signInGuest } = useSession();
  const [error, setError] = useState<unknown>(null);

  // The latest values, read inside the one-shot effect without re-running it.
  const latest = useRef({ state, signInGuest, router });
  useEffect(() => {
    latest.current = { state, signInGuest, router };
  });
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    const key = `${code ?? ""}|${g ?? ""}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    let cancelled = false;
    const { router: nav } = latest.current;
    const clean = extractInviteCode(code ?? "", 6);
    const guestId = g && /^[0-9a-f-]{36}$/i.test(g) ? g : null;

    (async () => {
      if (clean.length !== 6) {
        nav.replace("/invite");
        return;
      }
      // The guest already signed in as this person on this phone (tapping
      // the WhatsApp link again): straight home, no second onboarding.
      const current = latest.current.state;
      if (current.status === "guest" && current.inviteCode === clean && (!guestId || current.guest.id === guestId)) {
        nav.replace("/guest");
        return;
      }
      try {
        const opened = await post<{ tenant: TenantSummary }>("/auth/guest/open", { invite_code: clean });
        if (cancelled) return;
        const toFind = () => nav.replace({ pathname: "/find", params: { code: clean, tenant: JSON.stringify(opened.tenant) } });
        if (guestId) {
          try {
            const r = await post<{ token: string; guest: GuestIdentity }>("/auth/guest/session", { invite_code: clean, guest_id: guestId });
            if (cancelled) return;
            await latest.current.signInGuest({ token: r.token, tenant: opened.tenant, guest: r.guest, inviteCode: clean });
            if (cancelled) return;
            // Straight to the invitation (build 12, N24): notifications are
            // asked after the RSVP, on the confirmation.
            nav.replace("/guest");
            return;
          } catch (err) {
            // The personal link points at a guest the couple removed or
            // merged: the wedding still opens, so let them find their name.
            if (err instanceof ApiFailure && err.code === "not_found") {
              if (!cancelled) toFind();
              return;
            }
            throw err;
          }
        }
        toFind();
      } catch (err) {
        if (!cancelled) setError(err ?? new Error("failed"));
      }
    })();
    return () => {
      cancelled = true;
      // A remount (StrictMode, fast refresh) may start again.
      startedFor.current = null;
    };
  }, [code, g]);

  return (
    <Screen bottomInset={24}>
      {error ? (
        <Stack gap={14} style={{ marginTop: 80 }}>
          <T v="title30" accessibilityRole="alert">
            {guestErrorText(error, copy, lang)}
          </T>
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
