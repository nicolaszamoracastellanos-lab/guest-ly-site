// File a request: add seats, edit a guest, help with a guest, reminders, or
// something else. Validated and rebuilt server-side by createRequest; nothing
// here writes guest data.
//
// Build 12 (M12, prototype P.new):
// - The kinds are a 2 column grid with an icon and one line each, nothing
//   preselected. Opened with a kind (a guest row, Boda's "ask for access",
//   the reminders screen), the grid folds into one summary line with
//   "Change".
// - The guest is picked in a sheet with search ("Pick a guest"); a guest row
//   opens the form with that guest already picked (`guest` param).
// - Seats with - / +, no number pad (1 to 5, the portal's range).
// - "Send to the couple" is docked: above the tab bar at rest, right above the
//   keyboard while the note is typed. Disabled, it says why ("Pick a guest
//   first").
//
// Editing a request (`from`): the form opens prefilled from the original and
// saves through POST /planner/requests/{id}/edit, which changes it in place
// and adds an "edited" line to its conversation (core review P1-14). The kind
// cannot change.
//
// The body is built by lib/requestForm, exactly as the portal validates it.

import React, { useEffect, useRef, useState } from "react";
import { View, Alert, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, plural, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { usePlannerGuests, usePlannerRequest, type RequestRow, type PlannerGuest } from "@/lib/hooks";
import { buildRequestBody, fieldValid, formReady, MAX_REMIND, type EditField, type RequestKind as Kind } from "@/lib/requestForm";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Chip, ChipRow, Input, Card, ListRow, Avatar, Button, Stack, Field, Skeleton, T, Banner, Icon, Sheet, EmptyState, Row, toast, type IconName } from "@/ui";
import { colors, fonts, radius, HIT_TARGET } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { kindIcon } from "@/app/planner/_layout";

const KINDS: Kind[] = ["plus_one", "edit_guest", "guest_help", "send_reminders", "custom"];
const FIELDS: EditField[] = ["name", "party_size", "tags", "notes", "language"];
const MAX_SEATS = 5;

/** The form's starting values, from the request being changed. */
function seed(r: RequestRow | undefined) {
  const p = (r?.payload ?? {}) as Record<string, unknown>;
  const kind = (r && (KINDS as string[]).includes(r.kind) ? r.kind : null) as Kind | null;
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
  const c = copy.planner.b12;
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const couple = user?.me.tenant.couple_names ?? "";
  const guestsQuery = usePlannerGuests(user?.me.tenant.slug ?? "");
  const { data } = guestsQuery;
  const params = useLocalSearchParams<{ kind?: string; from?: string; guest?: string; title?: string }>();
  const fromQuery = usePlannerRequest(params.from ?? "");
  const original = fromQuery.data && fromQuery.data.status === "open" ? fromQuery.data : undefined;
  const replacing = !!params.from;
  const [start] = useState(() => {
    const s = seed(original);
    if (!original && (KINDS as string[]).includes(params.kind ?? "")) s.kind = params.kind as Kind;
    if (!original && params.guest && s.kind !== "send_reminders") s.guestId = params.guest;
    if (!original && typeof params.title === "string" && params.title) s.title = params.title.slice(0, 120);
    return s;
  });
  const [kind, setKind] = useState<Kind | null>(start.kind);
  // Opened with its kind (and guest) chosen: one summary line instead of the
  // grid, until "Change" (prototype P.new).
  const [summary, setSummary] = useState(() => !replacing && !!start.kind && (!needsGuestOf(start.kind) || !!start.guestId));
  const [guestId, setGuestId] = useState<string | null>(start.guestId);
  const [seats, setSeats] = useState(start.seats);
  const [field, setField] = useState<EditField | "">(start.field);
  const [value, setValue] = useState(start.value);
  const [title, setTitle] = useState(start.title);
  const [note, setNote] = useState(start.note);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
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

  const all = data?.guests ?? [];
  const guest = all.find((g) => g.id === guestId) ?? null;
  const pending = all.filter((g) => g.status === "pending").slice(0, MAX_REMIND);
  const needsGuest = needsGuestOf(kind);
  const seatsN = Math.min(MAX_SEATS, Math.max(1, parseInt(seats, 10) || 1));

  const form = kind ? { kind, guestId, seats, field, value, title, note } : null;
  // Typed text not sent yet asks before leaving (lib/unsaved).
  const base = original ? seed(original) : start;
  const leave = useUnsavedGuard(title.trim() !== base.title.trim() || note.trim() !== base.note.trim() || value.trim() !== base.value.trim() || (!summary && !replacing && kind !== base.kind));

  async function submit() {
    if (busy || !form) return;
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ["planner-requests"] });
      void qc.invalidateQueries({ queryKey: ["planner-home"] });
      leave.release();
      back();
      toast(replacing ? c.updated : fmt(c.sent, { names: couple }));
    } catch (err) {
      const f = err instanceof ApiFailure ? err : null;
      // not_open: the couple answered meanwhile. invalid: the server's own
      // sentence names the rule. Anything else: its bilingual message.
      Alert.alert(copy.common.error, f?.reason === "not_open" ? copy.core.editNotOpen : f ? f.messages[lang] : c.couldNotSave);
    } finally {
      setBusy(false);
    }
  }

  const ready = !!form && formReady(form, pending.length);
  // Why the button is off, in one line under it (D6).
  const why = !kind
    ? c.whyKind
    : needsGuest && !guestId
      ? c.whyGuest
      : (kind === "custom" || kind === "guest_help") && !title.trim()
        ? c.whyText
        : kind === "edit_guest" && !field
          ? c.whyField
          : kind === "edit_guest" && !fieldValid(field, value)
            ? c.whyValue
            : kind === "send_reminders" && data && !pending.length
              ? copy.core.remindNone
              : null;

  function pickKind(k: Kind) {
    void Haptics.selectionAsync();
    setKind(k);
    if (k === "send_reminders") setGuestId(null);
  }

  return (
    <Screen
      header={<TopBar onBack={() => leave(back)} />}
      keyboard
      dock={
        <View style={{ gap: 6 }}>
          <Button label={replacing ? copy.core.replaceAction : c.send} icon="arrow-up" onPress={submit} loading={busy} disabled={!ready || busy} testID="planner-request-send" />
          {!ready && why ? (
            <T v="meta13" color={colors.ivory70} center accessibilityLiveRegion="polite">
              {why}
            </T>
          ) : null}
        </View>
      }
    >
      <>
        <BigTitle title={replacing ? copy.core.replaceTitle : copy.planner.newRequest} sub={fmt(c.newSub, { names: couple })} size={34} />
        {replacing ? (
          <View style={{ marginTop: 14 }}>
            <Banner icon="info" kind="gold" title={copy.core.replaceNote} />
          </View>
        ) : null}

        <T v="body15" color={colors.ivory70} style={{ marginTop: 22, marginBottom: 8, fontFamily: fonts.bodyMedium }}>
          {c.what}
        </T>
        {replacing || summary ? (
          // Editing keeps the kind (the portal refuses a change of kind);
          // a preset kind shows as one line until "Change".
          kind ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={replacing ? copy.planner.kinds[kind] : `${copy.planner.kinds[kind]}, ${guest ? guest.name : c.kindSubs[kind]}, ${c.change}`}
              disabled={replacing}
              onPress={() => setSummary(false)}
              style={({ pressed }) => [styles.summary, pressed && { opacity: 0.85 }]}
              testID="planner-request-summary"
            >
              <Icon name={kindIcon(kind)} size={24} color={colors.goldLight} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="body16" color={colors.ivory}>
                  {copy.planner.kinds[kind]}
                </T>
                <T v="meta13" color={colors.ivory70} numberOfLines={1}>
                  {guest ? guest.name : c.kindSubs[kind]}
                </T>
              </View>
              {replacing ? null : (
                <T v="body15" color={colors.goldLight} style={{ fontFamily: fonts.bodyMedium }}>
                  {c.change}
                </T>
              )}
            </Pressable>
          ) : (
            <Skeleton h={64} r={12} />
          )
        ) : (
          <View style={styles.grid} accessibilityRole="radiogroup">
            {KINDS.map((k) => (
              <KindTile key={k} icon={kindIcon(k)} title={copy.planner.kinds[k]} sub={c.kindSubs[k]} on={kind === k} wide={k === "custom"} onPress={() => pickKind(k)} />
            ))}
          </View>
        )}

        <Stack gap={16} style={{ marginTop: 22 }}>
          {needsGuest && !(summary && guest) ? (
            <View>
              <T v="body15" color={colors.ivory70} style={{ marginBottom: 8, fontFamily: fonts.bodyMedium }}>
                {c.guest}
              </T>
              <Pressable accessibilityRole="button" accessibilityLabel={guest ? `${guest.name}, ${c.change}` : c.pickGuest} onPress={() => setPicking(true)} style={({ pressed }) => [styles.pick, pressed && { opacity: 0.85 }]} testID="planner-request-pick-guest">
                {guest ? (
                  <>
                    <Avatar initials={guest.initials} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="body16">{guest.name}</T>
                      <T v="meta13" color={colors.ivory70}>
                        {fmt(copy.guests.partyOf, { n: guest.party_size })}
                      </T>
                    </View>
                    <T v="body15" color={colors.goldLight} style={{ fontFamily: fonts.bodyMedium }}>
                      {c.change}
                    </T>
                  </>
                ) : !data && guestsQuery.isLoading && guestId ? (
                  <Skeleton h={40} />
                ) : (
                  <>
                    <Icon name="search" size={20} color={colors.ivory70} />
                    <T v="body16" color={colors.ivory55} style={{ flex: 1 }}>
                      {c.pickGuest}
                    </T>
                    <Icon name="chev" size={18} color={colors.ivory40} />
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {kind === "send_reminders" ? (
            <Card kind="solid" padding={16}>
              <Row>
                <Icon name="bell" size={22} color={colors.goldLight} />
                <T v="body15" color={pending.length || !data ? colors.ivory70 : colors.amber} style={{ flex: 1, marginLeft: 12 }}>
                  {data ? (pending.length ? plural(pending.length, copy.core.remindPending) : copy.core.remindNone) : ""}
                </T>
              </Row>
            </Card>
          ) : null}

          {kind === "plus_one" ? (
            <Card kind="solid" padding={16}>
              <Row style={{ justifyContent: "space-between" }}>
                <T v="body16">{c.seats}</T>
                <Stepper value={seatsN} min={1} max={MAX_SEATS} onChange={(n) => setSeats(String(n))} lessLabel={c.seatLess} moreLabel={c.seatMore} label={c.seats} />
              </Row>
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
                {guest ? fmt(plural(guest.party_size, c.seatsTotal), { name: guest.name, total: guest.party_size + seatsN }) : c.seatsNoGuest}
              </T>
            </Card>
          ) : null}

          {kind === "edit_guest" ? (
            <>
              {/* The detail is picked from a list: the field used to show the
                  raw keys as its placeholder and wanted one typed in. */}
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
            <Field label={kind === "custom" ? c.what : copy.planner.kinds.guest_help}>
              <Input value={title} onChangeText={setTitle} maxLength={120} placeholder={c.notePlaceholder} testID="planner-request-title" />
            </Field>
          ) : null}

          {kind ? (
            <Field label={copy.planner.noteForCouple}>
              <Input value={note} onChangeText={setNote} multiline maxLength={500} placeholder={c.notePlaceholder} testID="planner-request-note" />
            </Field>
          ) : null}
        </Stack>
      </>
      <GuestPicker
        visible={picking}
        guests={all}
        loading={!data && guestsQuery.isLoading}
        selected={guestId}
        onClose={() => setPicking(false)}
        onPick={(g) => {
          setGuestId(g.id);
          setPicking(false);
        }}
      />
    </Screen>
  );
}

function needsGuestOf(kind: Kind | null): boolean {
  return kind === "plus_one" || kind === "edit_guest" || kind === "guest_help";
}

function KindTile({ icon, title, sub, on, wide, onPress }: { icon: IconName; title: string; sub: string; on: boolean; wide?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [styles.kind, wide && styles.kindWide, on && styles.kindOn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      <Icon name={icon} size={24} color={colors.goldLight} />
      <View style={{ flex: wide ? 1 : undefined, gap: 2, paddingRight: 22 }}>
        <T v="body16" color={on ? colors.goldLight : colors.ivory} style={{ fontFamily: fonts.bodyMedium }}>
          {title}
        </T>
        <T v="meta13" color={colors.ivory70}>
          {sub}
        </T>
      </View>
      <View style={[styles.radio, on && styles.radioOn]}>{on ? <Icon name="check" size={14} color={colors.ink} /> : null}</View>
    </Pressable>
  );
}

function Stepper({ value, min, max, onChange, lessLabel, moreLabel, label }: { value: number; min: number; max: number; onChange: (n: number) => void; lessLabel: string; moreLabel: string; label: string }) {
  const step = (d: number) => {
    const n = Math.min(max, Math.max(min, value + d));
    if (n === value) return;
    void Haptics.selectionAsync();
    onChange(n);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      style={styles.stepper}
    >
      <Pressable accessibilityLabel={lessLabel} disabled={value <= min} onPress={() => step(-1)} style={[styles.stepBtn, value <= min && { opacity: 0.35 }]} testID="planner-seats-less">
        <T v="title26" color={colors.ivory}>
          −
        </T>
      </Pressable>
      <T v="title26" style={{ minWidth: 28, textAlign: "center", fontVariant: ["lining-nums"] }}>
        {String(value)}
      </T>
      <Pressable accessibilityLabel={moreLabel} disabled={value >= max} onPress={() => step(1)} style={[styles.stepBtn, value >= max && { opacity: 0.35 }]} testID="planner-seats-more">
        <Icon name="plus" size={20} color={colors.ivory} />
      </Pressable>
    </View>
  );
}

/** "Pick a guest": search by name or by any member of the party. */
function GuestPicker({ visible, guests, loading, selected, onClose, onPick }: { visible: boolean; guests: PlannerGuest[]; loading: boolean; selected: string | null; onClose: () => void; onPick: (g: PlannerGuest) => void }) {
  const copy = useCopy();
  const c = copy.planner.b12;
  const [q, setQ] = useState("");
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = guests.filter((g) => (q ? fold(g.name).includes(fold(q)) || g.members.some((m) => fold(m).includes(fold(q))) : true)).slice(0, 80);
  return (
    <Sheet visible={visible} onClose={onClose} form={false}>
      <T v="title26">{c.pickGuest}</T>
      <Input accessibilityLabel={c.search} icon="search" value={q} onChangeText={setQ} placeholder={c.search} autoCorrect={false} returnKeyType="search" style={{ marginTop: 12 }} />
      <View style={{ marginTop: 10 }}>
        {loading ? (
          <Stack gap={8}>
            <Skeleton h={56} />
            <Skeleton h={56} />
          </Stack>
        ) : list.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
            {list.map((g, i) => (
              <ListRow
                key={g.id}
                leading={<Avatar initials={g.initials} />}
                title={g.name}
                sub={fmt(copy.guests.partyOf, { n: g.party_size })}
                trailing={g.id === selected ? <Icon name="check" size={20} color={colors.goldLight} /> : undefined}
                chevron={false}
                onPress={() => onPick(g)}
                last={i === list.length - 1}
              />
            ))}
          </Card>
        ) : (
          <EmptyState title={q ? c.noMatch : copy.core.guestsEmpty} body={q ? c.noMatchBody : copy.core.guestsEmptyBody} />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  kind: { width: "48.8%", minHeight: 108, padding: 14, gap: 8, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.glassSolidFill },
  kindWide: { width: "100%", minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  kindOn: { borderColor: colors.gold, backgroundColor: colors.goldWash },
  radio: { position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.ivory40, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  summary: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, paddingLeft: 14, paddingRight: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldWash },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, paddingLeft: 14, paddingRight: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.glassSolidFill },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ivory14 },
  stepBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
});
