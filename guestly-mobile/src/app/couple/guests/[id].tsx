// Guest card (build 12, M8 + F3): a full-height sheet with the whole party by
// name, contact, history, language and table, and two main actions, "Edit
// guest" and "Edit RSVP", plus Message (their thread in the app) and Seat.
// The question waiting for the couple can be answered right here.

import React, { useState } from "react";
import { View, Linking, Alert, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, localized, useCopy, useLang, relTime, mediumDate } from "@/i18n";
import { get, post } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useGuestDetail, useCoupleRsvps, type InboxItem } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Row, Badge, Icon, Card, Button, Input, Stack, Skeleton, SectionLabel, Field, ButtonRow, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { useCoupleCopy, guestStatusText, statusIcon, statusColor, dayMonth, rsvpNoteText } from "@/features/couple/ui";
import { useFlash } from "@/features/couple/flash";

export default function GuestDetailScreen() {
  const copy = useCopy();
  const c = useCoupleCopy();
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mainQuery = useGuestDetail(id);
  const { data, isLoading } = mainQuery;
  const rsvps = useCoupleRsvps("pending");
  const d = data?.detail;
  const waiting = data?.waiting_for_you;
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [form, setForm] = useState<{ name: string; party_size: string; phone: string; email: string; notes: string; members: string } | null>(null);
  const canEdit = user?.me.can_edit ?? false;
  // "RSVP saved" from the Edit RSVP screen, or "Saved" after an edit here.
  const [notice, showNotice] = useFlash(`guest:${id}`);

  const status = d?.rsvp?.status === "attending" || d?.rsvp?.status === "declined" ? d.rsvp.status : "pending";
  // The real channel of the answer when the API sends it; "via" is left out
  // rather than guessed.
  const rsvpChannel = (d?.rsvp as { channel?: string | null; source?: string | null } | null | undefined) ?? null;
  const channelKey = rsvpChannel?.source ?? rsvpChannel?.channel ?? null;
  const channel = channelKey ? fmt(copy.rsvps.via, { channel: (copy.rsvps.channelNames as Record<string, string>)[channelKey] ?? channelKey }) : "";
  const seat = d?.seats?.[0] ?? null;
  const phone = d?.scope === "full" ? d.phone : null;
  const email = d?.scope === "full" ? d.email : null;
  const deadline = rsvps.data?.deadline ? dayMonth(rsvps.data.deadline, lang) : "";
  const answered = !!d?.rsvp?.updatedAt && status !== "pending";
  // The guest's own note on their RSVP ("note for the couple").
  const guestNote = rsvpNoteText(d?.rsvp?.notes);

  // Edits typed in the form and not saved ask before leaving (lib/unsaved).
  const initialForm = d ? { name: d.name, party_size: String(d.partySize), phone: phone ?? "", email: email ?? "", notes: d.notes ?? "", members: d.members.join("\n") } : null;
  const leave = useUnsavedGuard(editing && !!form && JSON.stringify(form) !== JSON.stringify(initialForm));

  // This card is a native modal: a push to another tab lands under it, so
  // close it first.
  function leaveCardThen(path: Parameters<typeof router.push>[0]) {
    if (router.canDismiss()) router.dismiss();
    router.push(path);
  }

  // Message: their conversation inside the app (N6). The question waiting
  // for you knows its thread; otherwise the inbox row with this guest.
  async function openMessages() {
    if (opening) return;
    if (waiting?.conversation_id) return leaveCardThen({ pathname: "/couple/messages/[id]", params: { id: waiting.conversation_id } } as never);
    setOpening(true);
    try {
      const cached = qc.getQueryData<{ items: InboxItem[] }>(["couple-inbox", "all"]);
      const inbox = cached ?? (await qc.fetchQuery({ queryKey: ["couple-inbox", "all"], queryFn: () => get<{ items: InboxItem[]; needs_you: number }>("/couple/messages?filter=all") }));
      const thread = inbox?.items.find((i) => i.guest_id === id);
      if (thread) return leaveCardThen({ pathname: "/couple/messages/[id]", params: { id: thread.id } } as never);
    } catch {
      // Offline: fall through to WhatsApp or the note.
    } finally {
      setOpening(false);
    }
    // No conversation yet: an announcement for just this guest (plan b,
    // "a notice only for them"), else their WhatsApp, else say so.
    if (canEdit) return leaveCardThen({ pathname: "/couple/broadcasts/new", params: { guest: id } } as never);
    if (phone) {
      void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`).catch(() => {});
      return;
    }
    showNotice(c.card.noThread);
  }

  function startEdit() {
    if (!d) return;
    setForm({ name: d.name, party_size: String(d.partySize), phone: phone ?? "", email: email ?? "", notes: d.notes ?? "", members: d.members.join("\n") });
    setEditing(true);
  }

  // A contact field is sent only when it changed: the new text, or null when
  // it was emptied (clears it). A scrubbed contact the viewer never saw is
  // never touched.
  function contactChange(before: string | null | undefined, after: string): string | null | undefined {
    if (d?.scope !== "full") return undefined;
    const next = after.trim();
    if (next === (before ?? "").trim()) return undefined;
    return next ? next : null;
  }

  async function saveEdit() {
    if (!form || busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        party_size: Math.max(1, parseInt(form.party_size, 10) || 1),
        notes: form.notes,
        members: form.members.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const nextPhone = contactChange(phone, form.phone);
      const nextEmail = contactChange(email, form.email);
      if (nextPhone !== undefined) body.phone = nextPhone;
      if (nextEmail !== undefined) body.email = nextEmail;
      await post(`/couple/guests/${id}`, body);
      // Party size moves the RSVP and home totals too.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["couple-guest", id] }),
        qc.invalidateQueries({ queryKey: ["couple-guests"] }),
        qc.invalidateQueries({ queryKey: ["couple-rsvps"] }),
        qc.invalidateQueries({ queryKey: ["couple-home"] }),
      ]);
      setEditing(false);
      showNotice(c.card.saved);
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!waiting || !reply.trim()) return;
    setBusy(true);
    try {
      await post(`/couple/messages/${waiting.conversation_id}/reply`, { text: reply.trim() });
      setReply("");
      await qc.invalidateQueries({ queryKey: ["couple-guest", id] });
      await qc.invalidateQueries({ queryKey: ["couple-inbox"] });
      showNotice(fmt(copy.inbox.sent, { name: d?.name ?? "" }));
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setBusy(false);
    }
  }

  // Event titles arrive as { en, es }; answers arrive as the raw enum.
  const answerWord = (a: string | null) => (a === "attending" ? c.card.member.going : a === "declined" ? c.card.member.notGoing : c.card.member.pending);

  // The party by name: the roster when the guest answered (who goes), else
  // the main guest plus the named members.
  const people: { name: string; state: string }[] = d
    ? d.roster?.length
      ? d.roster.map((r, i) => ({ name: r.name || (i === 0 ? d.name : fmt(copy.rsvp.guestN, { n: i + 1 })), state: status === "pending" ? "pending" : r.attending ? "attending" : "declined" }))
      : Array.from({ length: Math.max(1, d.partySize) }, (_, i) => ({ name: i === 0 ? d.name : (d.members[i - 1] ?? fmt(copy.rsvp.guestN, { n: i + 1 })), state: status }))
    : [];

  const history: { when: string; what: string; sub?: string }[] = [];
  if (d) {
    if (d.checkedInAt) history.push({ when: mediumDate(d.checkedInAt, lang), what: c.card.historyCheckedIn });
    if (answered && d.rsvp?.updatedAt) history.push({ when: mediumDate(d.rsvp.updatedAt, lang), what: `${c.card.historyReplied}: ${guestStatusText(c, status, d.rsvp.partySize ?? d.partySize)}`, sub: channel || undefined });
    if (d.lastRemindedAt) history.push({ when: mediumDate(d.lastRemindedAt, lang), what: c.card.historyReminded });
    if (d.createdAt) history.push({ when: mediumDate(d.createdAt, lang), what: c.card.historyAdded });
  }

  const dock =
    d && !editing ? (
      <View style={{ gap: 8 }}>
        {canEdit ? (
          <ButtonRow>
            <Button label={c.card.editGuest} kind="ghost" icon="edit" onPress={startEdit} testID="guest-edit" />
            <Button label={c.card.editRsvp} icon="check" onPress={() => router.push({ pathname: "/couple/guests/record", params: { guest: id } } as never)} testID="guest-edit-rsvp" />
          </ButtonRow>
        ) : null}
        <ButtonRow>
          <Button label={c.card.message} kind="glass" small icon="chat" loading={opening} onPress={() => void openMessages()} testID="guest-message" />
          <Button label={c.card.seat} kind="glass" small icon="grid" onPress={() => leaveCardThen("/couple/seating" as never)} testID="guest-seat" />
        </ButtonRow>
      </View>
    ) : d && editing && form ? (
      <ButtonRow>
        {/* Cancel asks before throwing typed edits away, like Back (S6). */}
        <Button label={copy.common.cancel} kind="ghost" onPress={() => leave(() => setEditing(false))} haptic={false} />
        <Button label={copy.common.save} onPress={saveEdit} loading={busy} disabled={!form.name.trim()} testID="guest-save" />
      </ButtonRow>
    ) : undefined;

  return (
    <Screen query={mainQuery} refresh header={<TopBar onBack={() => leave(back)} title={editing ? c.card.editGuest : c.card.title} />} keyboard dock={dock}>
      <>
        {isLoading && !d ? (
          <Stack gap={12} style={{ marginTop: 20 }}>
            <Skeleton h={56} />
            <Skeleton h={60} />
            <Skeleton h={60} />
          </Stack>
        ) : null}
        {d ? (
          <>
            <Row gap={14} style={{ marginTop: 12 }} align="flex-start">
              <Avatar initials={initialsOf(d.name)} size={56} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="title30">{d.name}</T>
                <T v="meta13" color={colors.ivory70}>
                  {answered && d.rsvp?.updatedAt ? c.card.repliedOn(relTime(d.rsvp.updatedAt, lang), channel) : deadline ? c.card.noReplyDeadline(deadline) : c.card.noReply}
                </T>
              </View>
            </Row>
            <Row gap={8} style={{ marginTop: 12, flexWrap: "wrap" }}>
              <View style={[styles.pill, { borderColor: status === "attending" ? "rgba(154,230,196,0.4)" : status === "pending" ? "rgba(243,198,107,0.45)" : colors.ivory14 }]}>
                <Icon name={statusIcon(status)} size={14} color={statusColor(status)} />
                <T v="meta13" color={colors.ivory90}>
                  {guestStatusText(c, status, d.rsvp?.partySize ?? d.partySize)}
                </T>
              </View>
              {d.tags.length ? <Badge label={d.tags.slice(0, 2).join(", ")} kind="mute" /> : null}
            </Row>

            {notice ? (
              <Row gap={8} style={{ marginTop: 12 }}>
                <Icon name="check" size={16} color={colors.greenText} />
                <T v="body15" color={colors.greenText} accessibilityLiveRegion="polite" style={{ flex: 1 }}>
                  {notice}
                </T>
              </Row>
            ) : null}

            {!editing ? (
              <View style={{ marginTop: 8 }}>
                <Section label={c.card.party(people.length)}>
                  {people.map((p, i) => (
                    <Line key={i} icon="guests" title={p.name} sub={answerWord(p.state)} last={i === people.length - 1} />
                  ))}
                </Section>

                <Section label={c.card.contact}>
                  {phone ? (
                    <Line icon="phone" title={phone} sub={c.card.phoneSub} onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`).catch(() => {})} last={!email} />
                  ) : d.scope === "full" ? (
                    <Line icon="phone" title={c.card.addPhone} sub={c.card.addPhoneSub} onPress={canEdit ? startEdit : undefined} last={!email} />
                  ) : null}
                  {email ? <Line icon="mail" title={email} sub={c.card.emailSub} onPress={() => void Linking.openURL(`mailto:${email}`).catch(() => {})} last /> : null}
                  {d.scope === "scrubbed" ? <Line icon="lock" title={c.card.contactHidden} sub={[d.hasPhone ? copy.guests.phone : null, d.hasEmail ? copy.guests.email : null].filter(Boolean).join(" · ") || undefined} last /> : null}
                </Section>

                {d.events.length ? (
                  <Section label={copy.guests.detail.ceremonyReception}>
                    {d.events.map((e, i) => (
                      <Line key={e.id} icon={statusIcon(e.answer ?? "pending")} title={localized(e.title, lang)} sub={answerWord(e.answer)} last={i === d.events.length - 1} />
                    ))}
                  </Section>
                ) : null}

                {d.answers.length ? (
                  <Section label={c.card.answers}>
                    {d.answers.map((a, i) => (
                      <Line key={i} icon="info" title={a.answer} sub={a.question} last={i === d.answers.length - 1} />
                    ))}
                  </Section>
                ) : null}

                {guestNote ? (
                  <Section label={c.card.guestNote(d.name.split(/\s+/)[0] || d.name)}>
                    <Line icon="chat" title={guestNote} last />
                  </Section>
                ) : null}

                {d.notes ? (
                  <Section label={c.card.notes}>
                    <Line icon="edit" title={d.notes} last />
                  </Section>
                ) : null}

                {history.length ? (
                  <Section label={c.card.history}>
                    {history.map((h, i) => (
                      <View key={i} style={[styles.hist, i < history.length - 1 && styles.line]}>
                        <T v="meta13" color={colors.ivory55} style={{ width: 84 }}>
                          {h.when}
                        </T>
                        <View style={{ flex: 1, gap: 2 }}>
                          <T v="body15" color={colors.ivory90}>
                            {h.what}
                          </T>
                          {h.sub ? (
                            <T v="meta13" color={colors.ivory55}>
                              {h.sub}
                            </T>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </Section>
                ) : null}

                <Section>
                  {d.language ? <Line icon="globe" title={c.card.language(c.card.langs[d.language] ?? d.language.toUpperCase())} /> : null}
                  <Line icon="grid" title={seat ? c.card.table(seat.table) : c.card.noTable} sub={seat?.plan ? `${seat.plan} · ${c.card.tableSub}` : c.card.tableSub} onPress={() => leaveCardThen("/couple/seating" as never)} last />
                </Section>

                {waiting ? (
                  <Stack gap={8} style={{ marginTop: 20 }}>
                    <SectionLabel>{copy.guests.detail.waiting}</SectionLabel>
                    <Card kind="solid" radiusKey="tile" padding={12} border="rgba(245,158,11,0.3)">
                      <Row gap={12}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber }} />
                        <T v="body15" color={colors.ivory90} style={{ flex: 1 }}>
                          {`"${waiting.text}"`}
                        </T>
                      </Row>
                      {canEdit ? (
                        <Row gap={8} style={{ marginTop: 10 }}>
                          <Input accessibilityLabel={copy.inbox.replyPlaceholder} value={reply} onChangeText={setReply} placeholder={copy.inbox.replyPlaceholder} style={{ flex: 1, minHeight: 48 }} />
                          <Button label={copy.guests.detail.reply} small full={false} onPress={sendReply} loading={busy} disabled={!reply.trim()} />
                        </Row>
                      ) : null}
                    </Card>
                  </Stack>
                ) : null}
              </View>
            ) : form ? (
              <Stack gap={10} style={{ marginTop: 20 }}>
                <Field label={copy.guests.name}>
                  <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} autoCapitalize="words" autoCorrect={false} textContentType="name" />
                </Field>
                <Field label={copy.guests.partySize}>
                  <Input value={form.party_size} onChangeText={(v) => setForm({ ...form, party_size: v.replace(/\D/g, "") })} keyboardType="number-pad" />
                </Field>
                <Field label={copy.guests.members}>
                  <Input value={form.members} onChangeText={(v) => setForm({ ...form, members: v })} multiline />
                </Field>
                <Field label={copy.guests.phone}>
                  <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" textContentType="telephoneNumber" />
                </Field>
                <Field label={copy.guests.email}>
                  <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </Field>
                <Field label={copy.guests.notes}>
                  <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline />
                </Field>
              </Stack>
            ) : null}
          </>
        ) : null}
      </>
    </Screen>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      {label ? <SectionLabel style={{ marginBottom: 6 }}>{label}</SectionLabel> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Line({ icon, title, sub, onPress, last }: { icon: IconName; title: string; sub?: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={sub ? `${title}, ${sub}` : title} style={({ pressed }) => [styles.lineRow, !last && styles.line, pressed && onPress ? { opacity: 0.7 } : null]}>
      <Icon name={icon} size={20} color={colors.goldLight} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body16" color={colors.ivory90}>
          {title}
        </T>
        {sub ? (
          <T v="meta13" color={colors.ivory55}>
            {sub}
          </T>
        ) : null}
      </View>
      {onPress ? <Icon name="chev" size={18} color={colors.ivory40} /> : null}
    </Pressable>
  );
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 30, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, backgroundColor: colors.glassSolidFill },
  card: { borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", paddingHorizontal: 14 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  hist: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
});

