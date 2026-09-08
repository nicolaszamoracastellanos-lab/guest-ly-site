// File a request: plus one, edit a guest, guest help, or something else.
// Validated and rebuilt server-side by createRequest; nothing here writes.

import React, { useState } from "react";
import { View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { usePlannerGuests } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Chip, ChipRow, Input, Card, ListRow, Avatar, Button, Row, Stack, T } from "@/ui";
import { colors } from "@/ui/tokens";

type Kind = "plus_one" | "edit_guest" | "guest_help" | "custom" | "send_reminders";

export default function NewRequest() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const { data } = usePlannerGuests(user?.me.tenant.slug ?? "");
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>((["plus_one", "edit_guest", "guest_help", "custom", "send_reminders"].includes(params.kind ?? "") ? params.kind : "plus_one") as Kind);
  const [q, setQ] = useState("");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [seats, setSeats] = useState("1");
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const guests = (data?.guests ?? []).filter((g) => (q ? fold(g.name).includes(fold(q)) : true)).slice(0, 6);
  const guest = data?.guests.find((g) => g.id === guestId) ?? null;
  const needsGuest = kind !== "custom" && kind !== "send_reminders";

  async function submit() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> =
        kind === "plus_one"
          ? { kind, additional_seats: Math.min(5, Math.max(1, parseInt(seats, 10) || 1)) }
          : kind === "edit_guest"
            ? { kind, patch: { [field.trim()]: value.trim() } }
            : kind === "guest_help"
              ? { kind, topic: title.trim() }
              : { kind, title: title.trim() };
      await post("/planner/requests", { kind, guest_ids: guestId ? [guestId] : [], payload, note });
      await qc.invalidateQueries({ queryKey: ["planner-requests"] });
      await qc.invalidateQueries({ queryKey: ["planner-home"] });
      router.back();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  const ready = (!needsGuest || guestId) && (kind !== "custom" || title.trim()) && (kind !== "guest_help" || title.trim()) && (kind !== "edit_guest" || (field.trim() && value.trim()));

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.planner.requests} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BigTitle title={copy.planner.newRequest} sub={copy.planner.footer} size={34} />
        <View style={{ marginTop: 18 }}>
          <ChipRow>
            {(["plus_one", "edit_guest", "guest_help", "send_reminders", "custom"] as Kind[]).map((k) => (
              <Chip key={k} label={copy.planner.kinds[k]} on={kind === k} onPress={() => setKind(k)} />
            ))}
          </ChipRow>
        </View>
        <Stack gap={10} style={{ marginTop: 18 }}>
          {needsGuest ? (
            guest ? (
              <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                <ListRow leading={<Avatar initials={guest.initials} />} title={guest.name} sub={fmt(copy.guests.partyOf, { n: guest.party_size })} onPress={() => setGuestId(null)} last />
              </Card>
            ) : (
              <>
                <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} />
                <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                  {guests.map((g, i) => (
                    <ListRow key={g.id} leading={<Avatar initials={g.initials} />} title={g.name} sub={fmt(copy.guests.partyOf, { n: g.party_size })} onPress={() => setGuestId(g.id)} last={i === guests.length - 1} />
                  ))}
                </Card>
              </>
            )
          ) : null}
          {kind === "plus_one" ? <Input value={seats} onChangeText={(v) => setSeats(v.replace(/\D/g, ""))} placeholder={copy.guests.partySize} keyboardType="number-pad" /> : null}
          {kind === "edit_guest" ? (
            <>
              <Input value={field} onChangeText={setField} placeholder="name | party_size | tags | notes | language" autoCapitalize="none" />
              <Input value={value} onChangeText={setValue} placeholder={copy.rsvp.answerPlaceholder} />
            </>
          ) : null}
          {kind === "guest_help" || kind === "custom" ? <Input value={title} onChangeText={setTitle} placeholder={kind === "custom" ? copy.planner.kinds.custom : copy.planner.kinds.guest_help} /> : null}
          <Input value={note} onChangeText={setNote} placeholder={copy.guests.notes} multiline style={{ borderRadius: 18 }} />
        </Stack>
        <Button label={copy.planner.newRequest} onPress={submit} loading={busy} disabled={!ready} style={{ marginTop: 22 }} />
        <T v="meta13" color={colors.ivory40} center style={{ marginTop: 12 }}>
          {copy.planner.footer}
        </T>
      </KeyboardAvoidingView>
    </Screen>
  );
}
