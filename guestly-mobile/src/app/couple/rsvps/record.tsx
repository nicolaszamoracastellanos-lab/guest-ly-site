// Record an RSVP on a guest's behalf: pick the guest, answer per seat and
// event, add a note. Goes through saveManualRsvp on the portal.

import React, { useEffect, useState } from "react";
import { View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang } from "@/i18n";
import { get, post, ApiFailure } from "@/lib/api";
import { useCoupleGuests, type GuestDetail } from "@/lib/hooks";
import { Screen, TopBar, BigTitle, Input, ListRow, Avatar, Card, Row, Segmented, Button, T, Badge, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

type Answer = "attending" | "declined";

export default function RecordRsvp() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useCoupleGuests(q, "all");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetail["detail"] | null>(null);
  const [seats, setSeats] = useState<Record<string, Answer>[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!guestId) return;
    get<GuestDetail>(`/couple/guests/${guestId}`).then((r) => {
      setDetail(r.detail);
      setSeats(Array.from({ length: r.detail.partySize }, () => ({})));
    });
  }, [guestId]);

  const events = detail?.events ?? [];
  const complete = detail ? seats.every((s) => events.every((e) => s[e.id])) : false;

  async function save() {
    if (!guestId || !complete) return;
    setBusy(true);
    try {
      await post("/couple/rsvps/record", { guest_id: guestId, seats, notes: notes || undefined });
      await qc.invalidateQueries({ queryKey: ["couple-rsvps"] });
      await qc.invalidateQueries({ queryKey: ["couple-guests"] });
      await qc.invalidateQueries({ queryKey: ["couple-home"] });
      router.back();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.rsvps.title} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BigTitle title={copy.rsvps.recordTitle} sub={copy.rsvps.recordIntro} size={34} />
        {!detail ? (
          <>
            <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoFocus style={{ marginTop: 18 }} />
            <Card kind="solid" padding={2} style={{ marginTop: 12, paddingHorizontal: 18 }}>
              {(data?.items ?? []).slice(0, 8).map((g, i, arr) => (
                <ListRow key={g.id} leading={<Avatar initials={g.initials} />} title={g.name} sub={fmt(copy.guests.partyOf, { n: g.party_size })} onPress={() => setGuestId(g.id)} last={i === arr.length - 1} />
              ))}
            </Card>
          </>
        ) : (
          <Stack gap={10} style={{ marginTop: 18 }}>
            {Array.from({ length: detail.partySize }, (_, i) => (
              <Card key={i} kind="solid" padding={14}>
                <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <T v="name24">{i === 0 ? detail.name : detail.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 })}</T>
                  <Badge label={i === 0 ? copy.rsvp.you : copy.rsvp.partyMember} kind={i === 0 ? "gold" : "mute"} />
                </Row>
                {events.map((e) => (
                  <Row key={e.id} style={{ justifyContent: "space-between", minHeight: 48 }}>
                    <T v="body16" style={{ flex: 1 }}>
                      {e.title}
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
            <Input value={notes} onChangeText={setNotes} placeholder={copy.rsvps.recordNotes} />
            <Row gap={8} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={copy.common.back} kind="ghost" onPress={() => { setDetail(null); setGuestId(null); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={copy.common.save} onPress={save} loading={busy} disabled={!complete} />
              </View>
            </Row>
            {!complete ? (
              <T v="meta13" color={colors.ivory55} center>
                {copy.rsvp.needsAnswer}
              </T>
            ) : null}
          </Stack>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
