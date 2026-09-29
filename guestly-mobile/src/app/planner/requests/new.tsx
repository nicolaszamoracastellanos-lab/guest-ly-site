// File a request: plus one, edit a guest, guest help, reminders, or something
// else. Validated and rebuilt server-side by createRequest; nothing here writes
// guest data.
//
// Editing a request (`from`): the form opens prefilled from the original and
// saves through POST /planner/requests/{id}/edit, which changes it in place
// and adds an "edited" line to its conversation (core review P1-14). The kind
// cannot change. It used to open blank and file a duplicate.
//
// The body is built by lib/requestForm, exactly as the portal validates it.

import React, { useEffect, useRef, useState } from "react";
import { View, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, plural, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { usePlannerGuests, usePlannerRequest, type RequestRow } from "@/lib/hooks";
import { buildRequestBody, formReady, MAX_REMIND, type EditField, type RequestKind as Kind } from "@/lib/requestForm";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Chip, ChipRow, Input, Card, ListRow, Avatar, Button, Stack, Field, Skeleton, T, Banner } from "@/ui";
import { colors } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

const KINDS: Kind[] = ["plus_one", "edit_guest", "guest_help", "send_reminders", "custom"];
const FIELDS: EditField[] = ["name", "party_size", "tags", "notes", "language"];

/** The form's starting values, from the request being changed. */
function seed(r: RequestRow | undefined) {
  const p = (r?.payload ?? {}) as Record<string, unknown>;
  const kind = (r && (KINDS as string[]).includes(r.kind) ? r.kind : "plus_one") as Kind;
  let field: EditField | "" = "";
  let value = "";
  if (kind === "edit_guest" && p.patch && typeof p.patch === "object") {
    const [k, v] = Object.entries(p.patch as Record<string, unknown>)[0] ?? [];
    if (k && (FIELDS as string[]).includes(k)) {
      field = k as EditField;
      value = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
    }
  }
  return {
    kind,
    guestId: kind === "send_reminders" ? null : (r?.guest_ids[0] ?? null),
    seats: typeof p.additional_seats === "number" ? String(p.additional_seats) : "1",
    field,
    value,
    title: typeof p.title === "string" ? p.title : typeof p.topic === "string" ? p.topic : "",
    note: r?.note ?? "",
  };
}

export default function NewRequest() {
  const copy = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const guestsQuery = usePlannerGuests(user?.me.tenant.slug ?? "");
  const { data } = guestsQuery;
  const params = useLocalSearchParams<{ kind?: string; from?: string }>();
  const fromQuery = usePlannerRequest(params.from ?? "");
  const original = fromQuery.data && fromQuery.data.status === "open" ? fromQuery.data : undefined;
  const replacing = !!params.from;
  const [start] = useState(() => {
    const s = seed(original);
    if (!original && (KINDS as string[]).includes(params.kind ?? "")) s.kind = params.kind as Kind;
    return s;
  });
  const [kind, setKind] = useState<Kind>(start.kind);
  const [q, setQ] = useState("");
  const [guestId, setGuestId] = useState<string | null>(start.guestId);
  const [seats, setSeats] = useState(start.seats);
  const [field, setField] = useState<EditField | "">(start.field);
  const [value, setValue] = useState(start.value);
  const [title, setTitle] = useState(start.title);
  const [note, setNote] = useState(start.note);
  const [busy, setBusy] = useState(false);
  // On a cold open the original arrives after the first render: apply it once.
  const seededFor = useRef<string | null>(original ? original.id : null);
  useEffect(() => {
    if (!original || seededFor.current === original.id) return;
    seededFor.current = original.id;
    const s = seed(original);
    setKind(s.kind);
    setGuestId(s.guestId);
    setSeats(s.seats);
    setField(s.field);
    setValue(s.value);
    setTitle(s.title);
    setNote(s.note);
  }, [original]);

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const all = data?.guests ?? [];
  const guests = all.filter((g) => (q ? fold(g.name).includes(fold(q)) : true)).slice(0, 6);
  const guest = all.find((g) => g.id === guestId) ?? null;
  const pending = all.filter((g) => g.status === "pending").slice(0, MAX_REMIND);
  const needsGuest = kind === "plus_one" || kind === "edit_guest" || kind === "guest_help";

  const form = { kind, guestId, seats, field, value, title, note };
  // Typed text not sent yet asks before leaving (lib/unsaved).
  const base = original ? seed(original) : start;
  const leave = useUnsavedGuard(title.trim() !== base.title.trim() || note.trim() !== base.note.trim() || value.trim() !== base.value.trim());

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const body = buildRequestBody(form, pending.map((g) => g.id));
      if (replacing && params.from) {
        // In place: same kind, the portal records the edit in the thread.
        await post(`/planner/requests/${params.from}/edit`, { payload: body.payload, note: body.note, guest_ids: body.guest_ids });
        await qc.invalidateQueries({ queryKey: ["planner-request", params.from] });
      } else {
        await post("/planner/requests", body);
      }
      await qc.invalidateQueries({ queryKey: ["planner-requests"] });
      await qc.invalidateQueries({ queryKey: ["planner-home"] });
      leave.release();
      back();
    } catch (err) {
      const f = err instanceof ApiFailure ? err : null;
      // not_open: the couple answered meanwhile. invalid: the server's own
      // sentence names the rule. Anything else: its bilingual message.
      Alert.alert(copy.common.error, f?.reason === "not_open" ? copy.core.editNotOpen : f ? f.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  const ready = formReady(form, pending.length);

  return (
    <Screen header={<TopBar onBack={() => leave(back)} title={copy.planner.requests} />} bottomInset={40} keyboard>
      <>
        <BigTitle title={replacing ? copy.core.replaceTitle : copy.planner.newRequest} sub={copy.planner.footer} size={34} />
        {replacing ? (
          <View style={{ marginTop: 14 }}>
            <Banner icon="info" kind="gold" title={copy.core.replaceNote} />
          </View>
        ) : null}
        <View style={{ marginTop: 18 }}>
          <ChipRow>
            {/* Editing keeps the kind: the portal refuses a change of kind. */}
            {(replacing ? [kind] : KINDS).map((k) => (
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
                <Input accessibilityLabel={copy.guests.search} icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoCorrect={false} />
                {!data && guestsQuery.isLoading ? (
                  <Stack gap={8}>
                    <Skeleton h={56} />
                    <Skeleton h={56} />
                  </Stack>
                ) : guests.length ? (
                  <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                    {guests.map((g, i) => (
                      <ListRow key={g.id} leading={<Avatar initials={g.initials} />} title={g.name} sub={fmt(copy.guests.partyOf, { n: g.party_size })} onPress={() => setGuestId(g.id)} last={i === guests.length - 1} />
                    ))}
                  </Card>
                ) : (
                  <T v="body15" color={colors.ivory55} style={{ paddingVertical: 8 }}>
                    {q ? copy.core.pickerEmpty : copy.core.guestsEmpty}
                  </T>
                )}
              </>
            )
          ) : null}
          {kind === "send_reminders" ? (
            <T v="body15" color={pending.length ? colors.ivory70 : colors.amber}>
              {data ? (pending.length ? plural(pending.length, copy.core.remindPending) : copy.core.remindNone) : ""}
            </T>
          ) : null}
          {kind === "plus_one" ? (
            <Field label={copy.planner.extraSeats}>
              <Input value={seats} onChangeText={(v) => setSeats(v.replace(/\D/g, "").slice(0, 1))} keyboardType="number-pad" />
            </Field>
          ) : null}
          {kind === "edit_guest" ? (
            <>
              {/* The detail is picked from a list: the field used to show the raw
                  keys as its placeholder and wanted one typed in. */}
              <Field label={copy.planner.fieldToChange}>
                <ChipRow>
                  {FIELDS.map((k) => (
                    <Chip
                      key={k}
                      label={copy.requests.changeFields[k]}
                      on={field === k}
                      onPress={() => {
                        if (field !== k) setValue("");
                        setField(k);
                      }}
                    />
                  ))}
                </ChipRow>
              </Field>
              {field === "language" ? (
                <Field label={copy.planner.newValue}>
                  <ChipRow>
                    <Chip label={copy.core.languageEn} on={value === "en"} onPress={() => setValue("en")} />
                    <Chip label={copy.core.languageEs} on={value === "es"} onPress={() => setValue("es")} />
                  </ChipRow>
                </Field>
              ) : field ? (
                <Field label={copy.planner.newValue} hint={field === "tags" ? copy.core.tagsHint : null}>
                  <Input value={value} onChangeText={setValue} keyboardType={field === "party_size" ? "number-pad" : "default"} multiline={field === "notes"} />
                </Field>
              ) : null}
            </>
          ) : null}
          {kind === "guest_help" || kind === "custom" ? (
            <Field label={kind === "custom" ? copy.planner.kinds.custom : copy.planner.kinds.guest_help}>
              <Input value={title} onChangeText={setTitle} maxLength={120} />
            </Field>
          ) : null}
          <Field label={copy.planner.noteForCouple}>
            <Input value={note} onChangeText={setNote} multiline maxLength={500} />
          </Field>
        </Stack>
        <Button label={replacing ? copy.core.replaceAction : copy.planner.newRequest} onPress={submit} loading={busy} disabled={!ready || busy} style={{ marginTop: 22 }} />
      </>
    </Screen>
  );
}
