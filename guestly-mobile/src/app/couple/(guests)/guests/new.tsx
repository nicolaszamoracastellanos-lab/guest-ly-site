// Add a guest (build 12, M9): a full-height sheet with Cancel and Save always
// visible on top, Name and Phone first, "More details" for plus-ones, names,
// email, language and notes. The keyboard gets Prev / Next / Done (a form
// Screen). A short phone number is flagged next to the field when you leave
// it. Save closes at once with "Guest added." (View opens the new card).
//
// HH Oct 30 2026: "Choose from contacts" fills name, phone and email from the
// people the couple picks (features/guests/contacts), never with a contacts
// permission prompt: the system picker hands over only the person tapped, and
// when the couple already chose limited access the iOS access picker shares
// only the people chosen. Only while access is limited, an inline Contact
// Access button under the name shares one more matching person with a tap.
// Hidden on builds without the module.

import React, { useEffect, useRef, useState } from "react";
import { View, Alert, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCopy, useLang } from "@/i18n";
import { post } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { Screen, TopBar, BigTitle, Input, Button, Row, Stack, Segmented, Field, T, Icon, Sheet, ListRow, Avatar, toast } from "@/ui";
import { contactsSupported, contactsAccess, pickContacts, sharedMatching, onContactsChange, type PickedContact } from "@/features/guests/contacts";
import { ContactAccessInline } from "@/features/guests/ContactAccessInline";
import { colors, radius } from "@/ui/tokens";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { useCoupleCopy } from "@/features/couple/ui";

const MIN_PHONE_DIGITS = 10;

export default function NewGuest() {
  const copy = useCopy();
  const c = useCoupleCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ name?: string }>();
  const startName = typeof params.name === "string" ? params.name : "";
  const [form, setForm] = useState({ name: startName, plus: 0, members: "", phone: "", email: "", notes: "", language: lang as "en" | "es" });
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const dirty = form.name.trim() !== startName.trim() || !!form.phone.trim() || !!form.email.trim() || !!form.notes.trim() || !!form.members.trim() || form.plus > 0;
  const leave = useUnsavedGuard(dirty && !busy);

  // Contacts: shown only on builds that carry the module (iOS).
  const canContacts = contactsSupported();
  const [access, setAccess] = useState<Awaited<ReturnType<typeof contactsAccess>>>("unavailable");
  const [choices, setChoices] = useState<PickedContact[]>([]);
  const nameRef = useRef(form.name);
  nameRef.current = form.name;
  useEffect(() => {
    if (canContacts) void contactsAccess().then(setAccess);
  }, [canContacts]);
  // Only under limited access: the inline button shared someone, so offer the
  // match for the typed name. With any other access nothing listens, so an
  // address book change can never trigger a search of the whole book.
  useEffect(() => {
    if (access !== "limited") return;
    return onContactsChange(() => {
      void sharedMatching(nameRef.current).then((m) => {
        if (m.length === 1) fill(m[0]);
        else if (m.length > 1) setChoices(m);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  function fill(p: PickedContact) {
    setChoices([]);
    setForm((f) => ({ ...f, name: p.name, phone: p.phone ?? f.phone, email: p.email ?? f.email }));
    setNameError(false);
    setPhoneError(false);
    if (p.email) setMore(true);
    toast(c.add.filled(p.name));
  }

  async function fromContacts() {
    const r = await pickContacts();
    void contactsAccess().then(setAccess);
    if (r.status === "picked") {
      if (r.contacts.length === 1) fill(r.contacts[0]);
      else setChoices(r.contacts);
    }
  }

  const phoneDigits = form.phone.replace(/\D/g, "");
  const phoneShort = phoneDigits.length > 0 && phoneDigits.length < MIN_PHONE_DIGITS;

  async function save() {
    if (busy) return;
    const name = form.name.trim().replace(/\s+/g, " ");
    setNameError(!name);
    setPhoneError(phoneShort);
    if (!name || phoneShort) return;
    setBusy(true);
    try {
      const r = await post<{ id?: string; guest_id?: string }>("/couple/guests", {
        name,
        party_size: form.plus + 1,
        members: form.members.split("\n").map((s) => s.trim()).filter(Boolean),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
        language: form.language,
        tags: [],
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ["couple-guests"] }), qc.invalidateQueries({ queryKey: ["couple-home"] }), qc.invalidateQueries({ queryKey: ["couple-rsvps"] })]);
      const id = typeof r?.id === "string" ? r.id : typeof r?.guest_id === "string" ? r.guest_id : null;
      back();
      // The guest cannot be deleted from the app, so the toast offers View,
      // not Undo.
      toast(c.add.added, id ? { undo: () => router.push({ pathname: "/couple/guests/[id]", params: { id } }), undoLabel: c.add.view } : {});
    } catch (err) {
      Alert.alert(copy.common.error, errorText(err, lang, copy.common.errorBody));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <TopBar
          left={<Button label={copy.common.cancel} kind="text" small full={false} haptic={false} onPress={() => leave(back)} testID="guest-cancel" />}
          right={<Button label={copy.common.save} small full={false} onPress={save} loading={busy} disabled={!form.name.trim()} testID="guest-save" />}
        />
      }
      keyboard
    >
      <>
        <BigTitle title={c.add.title} size={34} />
        {canContacts ? (
          <Stack gap={6} style={{ marginTop: 14 }}>
            <Button label={c.add.fromContacts} kind="glass" small icon="contacts" full={false} onPress={() => void fromContacts()} testID="guest-from-contacts" />
            <T v="caption14" color={colors.ivory55}>
              {c.add.fromContactsHint}
            </T>
          </Stack>
        ) : null}
        <Stack gap={14} style={{ marginTop: 16 }}>
          <Field label={c.add.name}>
            <Input
              value={form.name}
              onChangeText={(v) => {
                setForm({ ...form, name: v });
                if (v.trim()) setNameError(false);
              }}
              placeholder={c.add.namePlaceholder}
              autoFocus={!startName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              returnKeyType="next"
              testID="guest-name"
            />
          </Field>
          {nameError ? <ErrorLine text={c.add.nameError} /> : null}
          {access === "limited" && form.name.trim().length >= 2 && !form.phone.trim() ? <ContactAccessInline query={form.name.trim()} style={styles.access} /> : null}
          <Field label={c.add.phone} hint={phoneError ? null : c.add.phoneHint}>
            <Input
              value={form.phone}
              onChangeText={(v) => {
                setForm({ ...form, phone: v });
                if (v.replace(/\D/g, "").length >= MIN_PHONE_DIGITS || !v.trim()) setPhoneError(false);
              }}
              onBlur={() => setPhoneError(phoneShort)}
              placeholder={c.add.phonePlaceholder}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              testID="guest-phone"
            />
          </Field>
          {phoneError ? <ErrorLine text={c.add.phoneError} /> : null}

          <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" accessibilityState={{ expanded: more }} style={styles.more} testID="guest-more">
            <T v="body16" color={colors.goldLight}>
              {c.add.more}
            </T>
            <View style={{ transform: [{ rotate: more ? "180deg" : "0deg" }] }}>
              <Icon name="down" size={18} color={colors.goldLight} />
            </View>
          </Pressable>

          {more ? (
            <Stack gap={14}>
              <Row style={styles.stepRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body16">{c.add.plusOnes}</T>
                  <T v="meta13" color={colors.ivory55}>
                    {c.add.plusOnesSub}
                  </T>
                </View>
                <Row gap={4}>
                  <Pressable onPress={() => setForm({ ...form, plus: Math.max(0, form.plus - 1) })} disabled={form.plus === 0} accessibilityRole="button" accessibilityLabel={c.add.fewer} style={[styles.step, form.plus === 0 && { opacity: 0.4 }]}>
                    <T v="title26">-</T>
                  </Pressable>
                  <T v="title26" style={{ minWidth: 32, textAlign: "center" }} accessibilityLabel={`${c.add.plusOnes} ${form.plus}`}>
                    {String(form.plus)}
                  </T>
                  <Pressable onPress={() => setForm({ ...form, plus: Math.min(20, form.plus + 1) })} accessibilityRole="button" accessibilityLabel={c.add.more1} style={styles.step}>
                    <Icon name="plus" size={20} color={colors.ivory} />
                  </Pressable>
                </Row>
              </Row>
              {form.plus > 0 ? (
                <Field label={c.add.members}>
                  <Input value={form.members} onChangeText={(v) => setForm({ ...form, members: v })} multiline autoCapitalize="words" />
                </Field>
              ) : null}
              <Field label={c.add.email}>
                <Input value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" />
              </Field>
              <Field label={c.add.language}>
                <Segmented<"en" | "es">
                  value={form.language}
                  options={[
                    { value: "es", label: c.card.langs.es },
                    { value: "en", label: c.card.langs.en },
                  ]}
                  onChange={(v) => setForm({ ...form, language: v })}
                />
              </Field>
              <Field label={c.add.notes}>
                <Input value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline placeholder={c.add.notesPlaceholder} testID="guest-notes" />
              </Field>
            </Stack>
          ) : null}
        </Stack>
      </>
      <Sheet visible={choices.length > 0} onClose={() => setChoices([])}>
        <T v="title30">{c.add.chooseOne}</T>
        <View style={{ marginTop: 12 }}>
          {choices.map((p, i) => (
            <ListRow key={p.id} leading={<Avatar initials={initialsOf(p.name)} size={36} />} title={p.name} sub={[p.phone, p.email].filter(Boolean).join(" · ") || null} onPress={() => fill(p)} last={i === choices.length - 1} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function ErrorLine({ text }: { text: string }) {
  return (
    <Row gap={6} style={{ marginTop: -6 }}>
      <Icon name="warning" size={14} color={colors.red} />
      <T v="meta13" color={colors.red} accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        {text}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  access: { height: 52, alignSelf: "stretch", marginTop: -4 },
  more: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
  stepRow: { justifyContent: "space-between", minHeight: 56, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.ivory14, paddingHorizontal: 14 },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.ivory25, alignItems: "center", justifyContent: "center" },
});
