// Add a guest (through saveGuest on the portal).

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { Screen, TopBar, BigTitle, Input, Button, Row, Stack, Segmented, Field } from "@/ui";
import { useSafeBack } from "@/lib/nav";

export default function NewGuest() {
  const copy = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", party_size: "1", members: "", phone: "", email: "", notes: "", language: lang as "en" | "es" });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await post("/couple/guests", {
        name: form.name.trim(),
        party_size: Math.max(1, parseInt(form.party_size, 10) || 1),
        members: form.members.split("\n").map((s) => s.trim()).filter(Boolean),
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
        language: form.language,
        tags: [],
      });
      await qc.invalidateQueries({ queryKey: ["couple-guests"] });
      await qc.invalidateQueries({ queryKey: ["couple-home"] });
      back();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={back} title={copy.guests.title} />} bottomInset={40} keyboard>
      <>
        <BigTitle title={copy.guests.add} size={38} />
        {/* A visible label on every field: a placeholder disappears with the first
            character, and the seats field was a bare "1" (Part 9 audit, D-039). */}
        <Stack gap={14} style={{ marginTop: 20 }}>
          <Field label={copy.guests.name}>
            <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} autoFocus autoCapitalize="words" accessibilityLabel={copy.guests.name} />
          </Field>
          <Field label={copy.guests.partySize}>
            <Input value={form.party_size} onChangeText={(v) => setForm({ ...form, party_size: v.replace(/\D/g, "") })} keyboardType="number-pad" accessibilityLabel={copy.guests.partySize} />
          </Field>
          <Field label={copy.guests.members}>
            <Input value={form.members} onChangeText={(v) => setForm({ ...form, members: v })} multiline accessibilityLabel={copy.guests.members} />
          </Field>
          <Field label={copy.guests.phone}>
            <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" accessibilityLabel={copy.guests.phone} testID="guest-phone" />
          </Field>
          <Field label={copy.guests.email}>
            <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" accessibilityLabel={copy.guests.email} />
          </Field>
          <Field label={copy.guests.notes}>
            <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline accessibilityLabel={copy.guests.notes} testID="guest-notes" />
          </Field>
          <Field label={copy.guests.language}>
            <View style={{ width: 176 }}>
              <Segmented<"en" | "es"> value={form.language} options={[{ value: "en", label: "EN" }, { value: "es", label: "ES" }]} onChange={(v) => setForm({ ...form, language: v })} />
            </View>
          </Field>
        </Stack>
        <Row gap={8} style={{ marginTop: 24 }}>
          <View style={{ flex: 1 }}>
            <Button label={copy.common.cancel} kind="ghost" onPress={() => back()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={copy.common.save} onPress={save} loading={busy} disabled={!form.name.trim()} />
          </View>
        </Row>
      </>
    </Screen>
  );
}
