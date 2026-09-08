// People who can own tasks: portal members (read-only here) and helpers
// without a login (add, edit, remove).

import React, { useState } from "react";
import { Alert, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, del } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Button, Stack, Banner, Skeleton, Card, T, ListRow, Avatar, SectionLabel, Sheet, Input, Toggle, Row, Segmented, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/tasks/copy";
import { useTasksBoard, TASK_INVALIDATE, type Collaborator } from "@/features/tasks/hooks";
import { errorText, initials, Field, ConfirmSheet } from "@/features/tasks/ui";

type Form = { name: string; role_label: string; email: string; phone: string; language: "en" | "es"; notifications_enabled: boolean };
const blank: Form = { name: "", role_label: "", email: "", phone: "", language: "es", notifications_enabled: true };

export default function Collaborators() {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data: board, isLoading } = useTasksBoard();
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [removing, setRemoving] = useState<Collaborator | null>(null);
  const [busy, setBusy] = useState(false);

  async function invalidate() {
    for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const body = { ...editing.form, phone: editing.form.phone || null };
      if (editing.id) await post(`/couple/tasks/collaborators/${editing.id}`, body);
      else await post("/couple/tasks/collaborators", body);
      await invalidate();
      setEditing(null);
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await del(`/couple/tasks/collaborators/${removing.id}`);
      await invalidate();
      setRemoving(null);
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, ""));
    } finally {
      setBusy(false);
    }
  }

  const form = editing?.form ?? blank;
  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.title} />} bottomInset={60}>
      <BigTitle title={copy.collaborators} sub={copy.collaboratorsIntro} size={34} />
      {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
      <Stack gap={18} style={{ marginTop: 20 }}>
        {isLoading && !board ? <Skeleton h={120} r={18} /> : null}
        {board?.members.length ? (
          <View>
            <SectionLabel style={{ marginBottom: 6 }}>{copy.members}</SectionLabel>
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 14 }}>
              {board.members.map((m, i) => (
                <ListRow key={m.userId} leading={<Avatar initials={initials(m.name)} size={36} />} title={m.name} sub={`${m.email} · ${m.role}`} chevron={false} last={i === board.members.length - 1} />
              ))}
            </Card>
          </View>
        ) : null}
        <View>
          <SectionLabel style={{ marginBottom: 6 }}>{copy.helpers}</SectionLabel>
          {board && !board.collaborators.length ? (
            <T v="body15" color={colors.ivory55}>
              {copy.fields.noOwner}
            </T>
          ) : null}
          {board?.collaborators.length ? (
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 14 }}>
              {board.collaborators.map((c, i) => (
                <ListRow
                  key={c.id}
                  leading={<Avatar initials={initials(c.name)} size={36} />}
                  title={c.name}
                  sub={[c.role_label, c.email, c.notifications_enabled ? null : copy.helperFields.notify + ": off"].filter(Boolean).join(" · ")}
                  onPress={canEdit ? () => setEditing({ id: c.id, form: { name: c.name, role_label: c.role_label, email: c.email, phone: c.phone ?? "", language: c.language, notifications_enabled: c.notifications_enabled } }) : undefined}
                  last={i === board.collaborators.length - 1}
                />
              ))}
            </Card>
          ) : null}
        </View>
        {canEdit ? <Button label={copy.addHelper} icon="plus" onPress={() => setEditing({ id: null, form: blank })} disabled={!online} /> : null}
      </Stack>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} top={90}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
          <T v="title26">{editing?.id ? copy.editHelper : copy.addHelper}</T>
          <Field label={copy.helperFields.name}>
            <Input value={form.name} onChangeText={(v) => setF("name", v.slice(0, 80))} autoCapitalize="words" />
          </Field>
          <Field label={copy.helperFields.role}>
            <Input value={form.role_label} onChangeText={(v) => setF("role_label", v.slice(0, 60))} />
          </Field>
          <Field label={copy.helperFields.email}>
            <Input value={form.email} onChangeText={(v) => setF("email", v.trim().slice(0, 200))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Field label={copy.helperFields.phone}>
            <Input value={form.phone} onChangeText={(v) => setF("phone", v.slice(0, 40))} keyboardType="phone-pad" />
          </Field>
          <Field label={copy.helperFields.language}>
            <Segmented<"en" | "es"> value={form.language} options={[{ value: "es", label: "Español" }, { value: "en", label: "English" }]} onChange={(v) => setF("language", v)} />
          </Field>
          <Row style={{ justifyContent: "space-between", minHeight: 44 }}>
            <T v="body16">{copy.helperFields.notify}</T>
            <Toggle value={form.notifications_enabled} onChange={(v) => setF("notifications_enabled", v)} label={copy.helperFields.notify} />
          </Row>
          <Button label={copy.save} onPress={save} loading={busy} disabled={!form.name.trim() || !form.email.trim() || !online} />
          {editing?.id ? (
            <Button
              label={copy.removeHelper}
              kind="ghost"
              onPress={() => {
                const c = board?.collaborators.find((x) => x.id === editing.id) ?? null;
                setEditing(null);
                setRemoving(c);
              }}
            />
          ) : null}
          <Row gap={6} style={{ justifyContent: "center" }}>
            <Icon name="info" size={14} color={colors.ivory40} />
            <T v="meta13" color={colors.ivory40}>
              {copy.fields.remindersHint}
            </T>
          </Row>
        </ScrollView>
      </Sheet>
      <ConfirmSheet visible={!!removing} title={copy.removeHelper} body={copy.removeHelperBody} confirmLabel={copy.removeHelper} onConfirm={remove} onClose={() => setRemoving(null)} busy={busy} />
    </Screen>
  );
}
