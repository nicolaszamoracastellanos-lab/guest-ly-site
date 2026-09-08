// Find your name: names only, minimum 3 letters, party members only once
// the guest picks a row (the API returns the host name as party_of).

import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useSession, type TenantSummary, type GuestIdentity } from "@/lib/session";
import { Screen, TopBar, T, Input, Card, ListRow, Avatar, Stack, BigTitle } from "@/ui";
import { colors } from "@/ui/tokens";

type Candidate = { id: string; name: string; party_of: string | null };

export default function FindName() {
  const copy = useCopy();
  const { lang, applyTenantDefault } = useLang();
  const router = useRouter();
  const { signInGuest } = useSession();
  const params = useLocalSearchParams<{ code: string; tenant: string }>();
  const tenant = JSON.parse(params.tenant) as TenantSummary;
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyTenantDefault(tenant.locale_default);
  }, [tenant.locale_default, applyTenantDefault]);

  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(async () => {
      if (term.length < 3) {
        setCandidates([]);
        setHint(null);
        return;
      }
      try {
        const r = await post<{ candidates: Candidate[] }>("/auth/guest/identify", { invite_code: params.code, query: term });
        setCandidates(r.candidates);
        setHint(null);
      } catch (err) {
        setCandidates([]);
        if (err instanceof ApiFailure && err.code === "too_many_matches") setHint(copy.find.moreLetters);
        else if (err instanceof ApiFailure && err.code === "not_found") setHint(null);
        else setHint(err instanceof ApiFailure ? err.messages[lang] : copy.common.error);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [q, params.code, copy, lang]);

  async function pick(c: Candidate) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await post<{ token: string; guest: GuestIdentity }>("/auth/guest/session", { invite_code: params.code, guest_id: c.id });
      await signInGuest({ token: r.token, tenant, guest: r.guest, inviteCode: params.code });
      router.replace({ pathname: "/notify", params: { surface: "guest" } });
    } catch (err) {
      setHint(err instanceof ApiFailure ? err.messages[lang] : copy.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.guestHome.tabs.rsvp} />} bottomInset={24} keyboard>
      <BigTitle label={copy.find.step} title={copy.find.title} sub={copy.find.intro} size={38} />
      <Input
        icon="search"
        value={q}
        onChangeText={setQ}
        placeholder={copy.find.placeholder}
        autoFocus
        autoCorrect={false}
        autoCapitalize="words"
        style={{ marginTop: 22, borderColor: q ? "rgba(201,169,110,0.5)" : undefined }}
      />
      {candidates.length ? (
        <Card kind="solid" padding={4} style={{ marginTop: 14, paddingHorizontal: 18 }}>
          {candidates.map((c, i) => (
            <ListRow
              key={c.id + c.name}
              leading={<Avatar initials={initials(c.name)} />}
              title={c.name}
              sub={c.party_of ? `${copy.find.partyOf} ${c.party_of}` : null}
              onPress={() => pick(c)}
              last={i === candidates.length - 1}
            />
          ))}
        </Card>
      ) : null}
      {hint ? (
        <T v="body15" color={colors.amber} style={{ marginTop: 14 }}>
          {hint}
        </T>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <T v="meta13" color={colors.ivory55}>
          {copy.find.notYou}{" "}
          <T v="meta13" color={colors.goldLight}>
            {copy.find.tellCouple}
          </T>{" "}
          {copy.find.tellCoupleTail}
        </T>
      </View>
      <Stack gap={4} style={{ marginTop: 24 }}>
        <T v="meta13" color={colors.ivory40}>
          {fmt("{couple} · {date}", { couple: tenant.couple_names, date: tenant.wedding_date ?? "" })}
        </T>
      </Stack>
    </Screen>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
