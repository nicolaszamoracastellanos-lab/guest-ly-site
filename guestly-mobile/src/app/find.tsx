// Find your name: names only, minimum 3 letters, party members only once
// the guest picks a row (the API returns the host name as party_of).
//
// Build 12 (M2.name, N24): one step after the code. The wedding the code
// opened sits on top ("Code accepted"), no "Step 1 of 3", and picking a name
// lands on the invitation: no notification prompt (asked after the RSVP) and
// no tour. /notify stays for Info and deep links.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCopy, useLang, mediumDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { GUEST_COPY } from "@/features/guest/copy";
import { post, ApiFailure } from "@/lib/api";
import { useSession, type TenantSummary, type GuestIdentity } from "@/lib/session";
import { Screen, TopBar, T, Input, Card, ListRow, Avatar, Stack, Loading, Row, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { guestErrorText } from "@/features/guest/errors";

type Candidate = { id: string; name: string; party_of: string | null };

/** Case, accents and spacing do not make a new search. */
const normalize = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

export default function FindName() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang, applyTenantDefault } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const { signInGuest } = useSession();
  const params = useLocalSearchParams<{ code?: string; tenant?: string }>();
  // guestly://find with no wedding (an old link, a typo) used to throw here.
  const tenant = useMemo(() => {
    try {
      const t = JSON.parse(params.tenant ?? "") as TenantSummary | null;
      return t && typeof t === "object" && typeof t.slug === "string" ? t : null;
    } catch {
      return null;
    }
  }, [params.tenant]);
  const code = typeof params.code === "string" && params.code.length === 6 ? params.code : null;
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  // Only the newest search may write results: an older response that lands
  // late must not replace newer ones.
  const seq = useRef(0);
  const lastTerm = useRef("");

  useEffect(() => {
    if (!tenant || !code) router.replace("/invite");
  }, [tenant, code, router]);

  useEffect(() => {
    if (tenant) applyTenantDefault(tenant.locale_default);
  }, [tenant, applyTenantDefault]);

  useEffect(() => {
    if (!code) return;
    const term = q.trim();
    const norm = normalize(term);
    if (term.length < 3) {
      // Too short: results and hints hide (see `short`); any search still in
      // flight is ignored when it lands.
      seq.current++;
      lastTerm.current = "";
      return;
    }
    // A trailing space or a case change is not a new name.
    if (norm === lastTerm.current) return;
    // Searches run once typing pauses, so a name typed letter by letter is one
    // request (the server allows a few misses per wedding and network).
    const t = setTimeout(async () => {
      const id = ++seq.current;
      lastTerm.current = norm;
      setSearching(true);
      try {
        const r = await post<{ candidates: Candidate[] }>("/auth/guest/identify", { invite_code: code, query: term });
        if (id !== seq.current) return;
        setCandidates(r.candidates);
        setHint(r.candidates.length ? null : copy.find.noMatch);
      } catch (err) {
        if (id !== seq.current) return;
        setCandidates([]);
        if (err instanceof ApiFailure && err.code === "not_found") setHint(copy.find.noMatch);
        else {
          // Let the same text be searched again after a failure.
          lastTerm.current = "";
          setHint(guestErrorText(err, copy, lang));
        }
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [q, code, copy, lang]);

  async function pick(c: Candidate) {
    if (picking || !tenant || !code) return;
    setPicking(c.id + c.name);
    setHint(null);
    try {
      const r = await post<{ token: string; guest: GuestIdentity }>("/auth/guest/session", { invite_code: code, guest_id: c.id });
      await signInGuest({ token: r.token, tenant, guest: r.guest, inviteCode: code });
      // Straight to the invitation; the entrance flow is cleared so back never
      // walks through the code and the name again.
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // nothing to dismiss
      }
      router.replace("/guest");
    } catch (err) {
      setHint(guestErrorText(err, copy, lang));
    } finally {
      setPicking(null);
    }
  }

  const short = q.trim().length < 3;

  if (!tenant || !code) {
    return (
      <Screen>
        <Loading label={copy.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen header={<TopBar onBack={back} />} bottomInset={24} keyboard>
      <Card kind="solid" padding={16}>
        <Row gap={6}>
          <Icon name="check" size={16} color={colors.greenText} strokeWidth={2} />
          <T v="meta13" size={13} color={colors.greenText}>
            {g.find.codeOk}
          </T>
        </Row>
        <T v="name24" style={{ marginTop: 4 }}>
          {tenant.couple_names}
        </T>
        {tenant.wedding_date ? (
          <T v="meta13" color={colors.ivory70}>
            {mediumDate(tenant.wedding_date, lang)}
          </T>
        ) : null}
      </Card>
      <Stack gap={4} style={{ marginTop: 24 }}>
        <T v="title30" accessibilityRole="header">
          {copy.find.title}
        </T>
        <T v="body15" color={colors.ivory70}>
          {g.find.intro}
        </T>
      </Stack>
      <Input
        testID="find-input"
        icon="search"
        value={q}
        onChangeText={setQ}
        placeholder={copy.find.placeholder}
        accessibilityLabel={copy.find.placeholder}
        autoFocus
        autoCorrect={false}
        autoCapitalize="words"
        textContentType="name"
        returnKeyType="search"
        right={searching && !short ? <ActivityIndicator color={colors.goldLight} style={{ marginRight: 12 }} /> : undefined}
        style={{ marginTop: 16, borderColor: q ? "rgba(201,169,110,0.5)" : undefined }}
      />
      {short ? (
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
          {g.find.hint}
        </T>
      ) : null}
      {candidates.length && !short ? (
        <Card kind="solid" padding={4} style={{ marginTop: 14, paddingHorizontal: 18 }}>
          {candidates.map((c, i) => {
            const busy = picking === c.id + c.name;
            return (
              <ListRow
                testID={`find-row-${i}`}
                key={c.id + c.name}
                leading={<Avatar initials={initials(c.name)} />}
                title={c.name}
                sub={c.party_of ? `${copy.find.partyOf} ${c.party_of}` : null}
                trailing={busy ? <ActivityIndicator color={colors.goldLight} /> : undefined}
                chevron={!busy}
                onPress={() => pick(c)}
                last={i === candidates.length - 1}
              />
            );
          })}
        </Card>
      ) : null}
      {hint && !short ? (
        <T v="body15" color={colors.amber} style={{ marginTop: 14 }} accessibilityLiveRegion="polite">
          {hint}
        </T>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <T v="meta13" color={colors.ivory55}>
          {/* Plain text: there is no in-app way to reach the couple from here, so it
              must not look like a link (Part 9 audit, D-037). */}
          {copy.find.notYou} {copy.find.tellCouple} {copy.find.tellCoupleTail}
        </T>
      </View>
      <Row gap={8} align="flex-start" style={{ marginTop: 24 }}>
        <Icon name="lock" size={16} color={colors.ivory55} />
        <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
          {g.find.privacy}
        </T>
      </Row>
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
