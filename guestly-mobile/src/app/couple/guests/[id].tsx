// Guest detail sheet: RSVP, party, table, dietary, contact, the question
// waiting for the couple, message and edit.

import React, { useState } from "react";
import { View, Linking, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useGuestDetail } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Row, Badge, Icon, Card, Button, Input, Stack, Skeleton, SectionLabel, Footer } from "@/ui";
import { colors } from "@/ui/tokens";

export default function GuestDetailScreen() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useGuestDetail(id);
  const d = data?.detail;
  const waiting = data?.waiting_for_you;
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ name: string; party_size: string; phone: string; email: string; notes: string; members: string } | null>(null);
  const canEdit = user?.me.can_edit ?? false;

  const status = d?.rsvp?.status ?? "pending";
  const statusLabel = status === "attending" ? copy.guests.filters.attending : status === "declined" ? copy.guests.filters.declined : copy.guests.filters.pending;
  const channel = d?.rsvp ? (copy.rsvps.channelNames as Record<string, string>)["app"] : "";
  const table = d?.seats?.[0]?.table ?? null;
  const phone = d?.scope === "full" ? d.phone : null;
  const email = d?.scope === "full" ? d.email : null;

  function startEdit() {
    if (!d) return;
    setForm({ name: d.name, party_size: String(d.partySize), phone: phone ?? "", email: email ?? "", notes: d.notes ?? "", members: d.members.join("\n") });
    setEditing(true);
  }

  async function saveEdit() {
    if (!form) return;
    setBusy(true);
    try {
      await post(`/couple/guests/${id}`, {
        name: form.name,
        party_size: Math.max(1, parseInt(form.party_size, 10) || 1),
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes,
        members: form.members.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      await qc.invalidateQueries({ queryKey: ["couple-guest", id] });
      await qc.invalidateQueries({ queryKey: ["couple-guests"] });
      setEditing(false);
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
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
      Alert.alert(copy.inbox.reply, fmt(copy.inbox.sent, { name: d?.name ?? "" }));
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false} padded={false} bottomInset={0} header={<TopBar onBack={() => router.back()} title={copy.guests.title} />}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {isLoading && !d ? (
            <Stack gap={12} style={{ marginTop: 20 }}>
              <Skeleton h={56} />
              <Skeleton h={60} />
              <Skeleton h={60} />
            </Stack>
          ) : null}
          {d ? (
            <>
              <Row gap={14} style={{ marginTop: 16 }}>
                <Avatar initials={initialsOf(d.name)} size={56} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T v="title30">{d.name}</T>
                  <T v="meta13" color={colors.ivory55}>
                    {fmt(copy.guests.partyOf, { n: d.partySize })}
                    {d.tags.length ? ` · ${d.tags.join(", ")}` : ""}
                    {d.language ? ` · ${d.language.toUpperCase()}` : ""}
                  </T>
                </View>
                <Badge label={statusLabel} kind={status === "attending" ? "green" : status === "pending" ? "amber" : "mute"} />
              </Row>

              {!editing ? (
                <View style={{ marginTop: 18 }}>
                  <DetailRow icon="check" iconColor={status === "attending" ? colors.greenText : colors.goldLight} title={d.events.length ? d.events.map((e) => `${e.title}: ${e.answer ?? "·"}`).join(" · ") : copy.guests.detail.ceremonyReception} sub={d.rsvp?.updatedAt ? fmt(copy.guests.detail.answered, { when: relTime(d.rsvp.updatedAt, lang), channel }) : copy.guests.detail.notAnswered} />
                  {d.members.length ? <DetailRow icon="guests" title={d.members.join(", ")} sub={copy.rsvp.partyMember} /> : null}
                  <DetailRow icon="grid" title={table ? `${copy.guests.detail.table} ${table}` : copy.guests.detail.noTable} sub={d.seats[0]?.plan ?? null} />
                  {d.answers.length ? <DetailRow icon="info" title={d.answers.map((a) => a.answer).join(", ")} sub={d.answers.map((a) => a.question).join(" · ")} /> : null}
                  {d.notes ? <DetailRow icon="edit" title={d.notes} sub={copy.guests.notes} /> : null}
                  {phone || email ? (
                    <DetailRow icon="phone" title={[phone, email].filter(Boolean).join(" · ")} sub={copy.guests.detail.contact} onPress={() => phone && Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)} />
                  ) : d.scope === "scrubbed" ? (
                    <DetailRow icon="lock" title={copy.guests.detail.contact} sub={[d.hasPhone ? copy.guests.phone : null, d.hasEmail ? copy.guests.email : null].filter(Boolean).join(" · ") || "·"} />
                  ) : null}
                  {d.checkedInAt ? <DetailRow icon="qr" title={copy.guests.detail.checkedIn} sub={relTime(d.checkedInAt, lang)} /> : null}

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
                            <Input value={reply} onChangeText={setReply} placeholder={copy.inbox.replyPlaceholder} style={{ flex: 1, minHeight: 48 }} />
                            <Button label={copy.guests.detail.reply} small full={false} onPress={sendReply} loading={busy} disabled={!reply.trim()} />
                          </Row>
                        ) : null}
                      </Card>
                    </Stack>
                  ) : null}

                  <Row gap={8} style={{ marginTop: 28 }}>
                    <View style={{ flex: 1 }}>
                      <Button label={copy.guests.detail.message} icon="chat" onPress={() => (phone ? Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`) : router.push("/couple/messages"))} />
                    </View>
                    {canEdit ? (
                      <View style={{ flex: 1 }}>
                        <Button label={copy.guests.detail.edit} icon="edit" kind="ghost" onPress={startEdit} />
                      </View>
                    ) : null}
                  </Row>
                </View>
              ) : form ? (
                <Stack gap={10} style={{ marginTop: 20 }}>
                  <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={copy.guests.name} />
                  <Input value={form.party_size} onChangeText={(v) => setForm({ ...form, party_size: v.replace(/\D/g, "") })} placeholder={copy.guests.partySize} keyboardType="number-pad" />
                  <Input value={form.members} onChangeText={(v) => setForm({ ...form, members: v })} placeholder={copy.guests.members} multiline style={{ borderRadius: 18 }} />
                  <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder={copy.guests.phone} keyboardType="phone-pad" />
                  <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder={copy.guests.email} keyboardType="email-address" autoCapitalize="none" />
                  <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder={copy.guests.notes} multiline style={{ borderRadius: 18 }} />
                  <Row gap={8} style={{ marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button label={copy.common.cancel} kind="ghost" onPress={() => setEditing(false)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label={copy.common.save} onPress={saveEdit} loading={busy} />
                    </View>
                  </Row>
                </Stack>
              ) : null}
            </>
          ) : null}
          <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function DetailRow({ icon, iconColor = colors.goldLight, title, sub, onPress }: { icon: React.ComponentProps<typeof Icon>["name"]; iconColor?: string; title: string; sub?: string | null; onPress?: () => void }) {
  return (
    <Row gap={14} style={{ minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory09 }}>
      <Icon name={icon} size={22} color={iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body16" color={colors.ivory90} onPress={onPress}>
          {title}
        </T>
        {sub ? (
          <T v="meta13" color={colors.ivory55}>
            {sub}
          </T>
        ) : null}
      </View>
      {onPress ? <Icon name="chev" size={18} color={colors.ivory40} /> : null}
    </Row>
  );
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
