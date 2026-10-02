// Add or edit a vendor (couple only). With ?id=... it edits that vendor.
// With ?link=<budget line id> (from a budget line, build 12) the new vendor is
// linked to that line once saved.

import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, T, Row, Stack, Button, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "../copy";
import { useVendors, useVendorWrites, type VendorCategory, type VendorStatus, type VendorRow } from "../hooks";
import { TextField, Options, useAction } from "../../budget/ui";
import { parseAmount, numText } from "../../budget/money";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";

const CATEGORIES: VendorCategory[] = ["venue", "catering", "photo", "video", "music", "flowers", "decor", "beauty", "attire", "cake", "transport", "stationery", "planner", "rentals", "other"];
const STATUSES: VendorStatus[] = ["shortlist", "contacted", "quoted", "booked", "done", "cancelled"];

type Form = {
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  price_quoted: string;
  currency: string;
  rating: number | null;
  notes: string;
};

const EMPTY: Form = { name: "", category: "venue", status: "shortlist", contact_name: "", phone: "", email: "", website: "", instagram: "", address: "", price_quoted: "", currency: "", rating: null, notes: "" };

function fromRow(v: VendorRow): Form {
  return { name: v.name, category: v.category, status: v.status, contact_name: v.contact_name ?? "", phone: v.phone ?? "", email: v.email ?? "", website: v.website ?? "", instagram: v.instagram ?? "", address: v.address ?? "", price_quoted: numText(v.price_quoted), currency: v.currency ?? "", rating: v.rating, notes: v.notes ?? "" };
}

export function VendorFormScreen() {
  const copy = useFeatureCopy(COPY);
  const back = useSafeBack();
  const params = useLocalSearchParams<{ id?: string; link?: string }>();
  const linkItem = typeof params.link === "string" && params.link ? params.link : null;
  const { data } = useVendors();
  const writes = useVendorWrites();
  const { busy, act } = useAction();
  const editing = params.id ? data?.vendors.find((v) => v.id === params.id) ?? null : null;
  // Seed once per screen target: a vendor id, or "new" for a blank card. Add
  // used to open with the last edited vendor's fields and save a duplicate.
  const target = params.id ?? "new";
  const [form, setForm] = useState<Form>(EMPTY);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seeded !== target && (editing || !params.id)) {
    setForm(editing ? fromRow(editing) : EMPTY);
    setSeeded(target);
  }
  const canEdit = data?.can_edit ?? false;
  // Typed changes not saved yet ask before leaving (lib/unsaved).
  const leave = useUnsavedGuard(seeded === target && JSON.stringify(form) !== JSON.stringify(editing ? fromRow(editing) : EMPTY));

  async function save() {
    const body = {
      name: form.name.trim(),
      category: form.category,
      status: form.status,
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      website: form.website.trim(),
      instagram: form.instagram.trim(),
      address: form.address.trim(),
      price_quoted: form.price_quoted.trim() ? parseAmount(form.price_quoted) : null,
      currency: form.currency.trim() ? form.currency.trim().toUpperCase() : null,
      rating: form.rating,
      notes: form.notes.trim(),
    };
    await act(
      async () => {
        if (editing) return writes.update(editing.id, body);
        const r = await writes.create(body);
        if (linkItem && r?.id) await writes.link(r.id, linkItem);
        return r;
      },
      () => {
        leave.release();
        setForm(EMPTY);
        setSeeded(null);
        back();
      }
    );
  }

  return (
    <Screen header={<TopBar onBack={() => leave(back)} title={copy.title} />} bottomInset={40} keyboard>
      <>
        <BigTitle title={editing ? copy.edit : copy.add} size={36} />
        <Stack gap={12} style={{ marginTop: 18 }}>
          <TextField label={copy.name} value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoCapitalize="words" />
          <View style={{ gap: 6 }}>
            <SectionLabel>{copy.category}</SectionLabel>
            <Options<VendorCategory> value={form.category} options={CATEGORIES.map((c) => ({ value: c, label: copy.categories[c] }))} onChange={(v) => setForm({ ...form, category: v })} />
          </View>
          <View style={{ gap: 6 }}>
            <SectionLabel>{copy.status}</SectionLabel>
            <Options<VendorStatus> value={form.status} options={STATUSES.map((s) => ({ value: s, label: copy.statuses[s] }))} onChange={(v) => setForm({ ...form, status: v })} />
          </View>
          <TextField label={copy.contactName} value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} autoCapitalize="words" />
          <TextField label={copy.phone} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
          <TextField label={copy.email} value={form.email} onChange={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
          <TextField label={copy.website} value={form.website} onChange={(v) => setForm({ ...form, website: v })} keyboardType="url" autoCapitalize="none" />
          <TextField label={copy.instagram} value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} autoCapitalize="none" />
          <TextField label={copy.address} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Row gap={8}>
            <View style={{ flex: 2 }}>
              <TextField label={copy.priceQuoted} value={form.price_quoted} onChange={(v) => setForm({ ...form, price_quoted: v })} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={copy.currency} value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase().slice(0, 3) })} autoCapitalize="characters" />
            </View>
          </Row>
          <View style={{ gap: 6 }}>
            <SectionLabel>{copy.rating}</SectionLabel>
            <Row gap={4}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setForm({ ...form, rating: form.rating === n ? null : n })} accessibilityRole="button" accessibilityLabel={`${n}`} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <T v="title26" color={form.rating !== null && n <= form.rating ? colors.goldLight : colors.ivory25}>
                    ★
                  </T>
                </Pressable>
              ))}
            </Row>
          </View>
          <TextField label={copy.notes} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} multiline />
        </Stack>
        <Row gap={8} style={{ marginTop: 24 }}>
          <View style={{ flex: 1 }}>
            <Button label={copy.cancel} kind="ghost" onPress={() => back()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={copy.save} onPress={save} loading={busy} disabled={!form.name.trim() || !canEdit || busy} />
          </View>
        </Row>
      </>
    </Screen>
  );
}
