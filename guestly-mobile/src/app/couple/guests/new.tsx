// Add a guest (through saveGuest on the portal).

import React, { useState } from "react";
import { View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { Screen, TopBar, BigTitle, Input, Button, Row, Stack, Segmented } from "@/ui";

export default function NewGuest() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
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
      router.back();
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.guests.title} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BigTitle title={copy.guests.add} size={38} />
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={copy.guests.name} autoFocus autoCapitalize="words" />
          <Input value={form.party_size} onChangeText={(v) => setForm({ ...form, party_size: v.replace(/\D/g, "") })} placeholder={copy.guests.partySize} keyboardType="number-pad" />
          <Input value={form.members} onChangeText={(v) => setForm({ ...form, members: v })} placeholder={copy.guests.members} multiline style={{ borderRadius: 18 }} />
          <Input value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder={copy.guests.phone} keyboardType="phone-pad" />
          <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder={copy.guests.email} keyboardType="email-address" autoCapitalize="none" />
          <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder={copy.guests.notes} multiline style={{ borderRadius: 18 }} />
          <View style={{ width: 176 }}>
            <Segmented<"en" | "es"> value={form.language} options={[{ value: "en", label: "EN" }, { value: "es", label: "ES" }]} onChange={(v) => setForm({ ...form, language: v })} />
          </View>
        </Stack>
        <Row gap={8} style={{ marginTop: 24 }}>
          <View style={{ flex: 1 }}>
            <Button label={copy.common.cancel} kind="ghost" onPress={() => router.back()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={copy.common.save} onPress={save} loading={busy} disabled={!form.name.trim()} />
          </View>
        </Row>
      </KeyboardAvoidingView>
    </Screen>
  );
}
