// Record an RSVP on a guest's behalf: pick the guest, answer per seat and
// event, add a note. Goes through saveManualRsvp on the portal.

import React, { useState } from "react";
import { View, Alert, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, localized, useCopy, useLang } from "@/i18n";
import { get, post } from "@/lib/api";
import type { GuestDetail } from "@/lib/hooks";
import { useGuestPages } from "@/features/guests/hooks";
import { errorText } from "@/features/shared/requests";
import { Screen, TopBar, BigTitle, Input, ListRow, Avatar, Card, Row, Segmented, Button, T, Badge, Stack } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";

type Answer = "attending" | "declined";

export default function RecordRsvp() {
  const copy = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const guests = useGuestPages(q, "all");
  const matches = guests.items.slice(0, 20);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetail["detail"] | null>(null);
  const [seats, setSeats] = useState<Record<string, Answer>[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Opens a guest's seats. A failure (offline, the guest was removed) says so
  // and leaves the list tappable again, including the same guest.
  async function openGuest(id: string) {
    if (opening) return;
    setOpening(id);
    try {
      const r = await qc.fetchQuery({ queryKey: ["couple-guest", id], queryFn: () => get<GuestDetail>(`/couple/guests/${id}`) });
      setGuestId(id);
      setDetail(r.detail);
      setSeats(Array.from({ length: Math.max(1, r.detail.partySize) }, () => ({})));
      setNotes("");
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setOpening(null);
    }
  }

  function closeGuest() {
    setDetail(null);
    setGuestId(null);
    setSeats([]);
    setNotes("");
  }

  const events = detail?.events ?? [];
  // A guest with no events has nothing to answer: never save empty seats.
  const complete = detail ? events.length > 0 && seats.every((s) => events.every((e) => s[e.id])) : false;

  async function save() {
    if (!guestId || !complete || busy) return;
    setBusy(true);
    try {
      await post("/couple/rsvps/record", { guest_id: guestId, seats, notes: notes.trim() || undefined });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["couple-rsvps"] }),
        qc.invalidateQueries({ queryKey: ["couple-guests"] }),
        qc.invalidateQueries({ queryKey: ["couple-guest", guestId] }),
        qc.invalidateQueries({ queryKey: ["couple-home"] }),
      ]);
      back();
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={back} title={copy.rsvps.title} />} bottomInset={40} keyboard>
      <>
        <BigTitle title={copy.rsvps.recordTitle} sub={copy.rsvps.recordIntro} size={34} />
        {!detail ? (
          <>
            <Input accessibilityLabel={copy.guests.search} icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoFocus autoCorrect={false} style={{ marginTop: 18 }} />
            {matches.length ? (
              <Card kind="solid" padding={2} style={{ marginTop: 12, paddingHorizontal: 18 }}>
                {matches.map((g, i, arr) => (
                  <ListRow
                    key={g.id}
                    leading={<Avatar initials={g.initials} />}
                    title={g.name}
                    sub={fmt(copy.guests.partyOf, { n: g.party_size })}
                    trailing={opening === g.id ? <ActivityIndicator color={colors.goldLight} /> : undefined}
                    onPress={() => void openGuest(g.id)}
                    last={i === arr.length - 1}
                  />
                ))}
              </Card>
            ) : guests.isLoading ? null : (
              <T v="body15" color={colors.ivory55} style={{ marginTop: 14 }}>
                {q.trim() ? copy.guests.noMatchTitle : copy.guests.emptyTitle}
              </T>
            )}
            {guests.items.length > matches.length || guests.hasNextPage ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
                {copy.find.moreLetters}
              </T>
            ) : null}
          </>
        ) : (
          <Stack gap={10} style={{ marginTop: 18 }}>
            {Array.from({ length: detail.partySize }, (_, i) => (
              <Card key={i} kind="solid" padding={14}>
                <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <T v="name24">{i === 0 ? detail.name : detail.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 })}</T>
                  <Badge label={i === 0 ? copy.rsvps.mainGuest : copy.rsvp.partyMember} kind={i === 0 ? "gold" : "mute"} />
                </Row>
                {events.map((e) => (
                  <Row key={e.id} style={{ justifyContent: "space-between", minHeight: 48 }}>
                    <T v="body16" style={{ flex: 1 }}>
                      {localized(e.title, lang)}
                    </T>
                    <View style={{ width: 176 }}>
                      <Segmented<Answer>
                        value={seats[i]?.[e.id] ?? null}
                        options={[{ value: "attending", label: copy.rsvp.attending }, { value: "declined", label: copy.rsvp.declined }]}
                        onChange={(v) => setSeats((prev) => prev.map((s, j) => (j === i ? { ...s, [e.id]: v } : s)))}
                      />
                    </View>
                  </Row>
                ))}
              </Card>
            ))}
            {events.length === 0 ? <T v="body15" color={colors.amber}>{copy.rsvps.recordNoEvents}</T> : null}
            <Input accessibilityLabel={copy.rsvps.recordNotes} value={notes} onChangeText={setNotes} placeholder={copy.rsvps.recordNotes} />
            <Row gap={8} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={copy.common.back} kind="ghost" onPress={closeGuest} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={copy.common.save} onPress={save} loading={busy} disabled={!complete} />
              </View>
            </Row>
            {!complete && events.length > 0 ? (
              <T v="meta13" color={colors.ivory55} center>
                {copy.rsvp.needsAnswer}
              </T>
            ) : null}
          </Stack>
        )}
      </>
    </Screen>
  );
}
