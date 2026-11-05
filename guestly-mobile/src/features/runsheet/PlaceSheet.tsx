// #9: add or edit one place of the wedding day (couple, timeline not locked).
// Writes go to /couple/places (404 while MW_PLACES is off: the section then
// goes away on the next read). Delete commits at once with Undo, which brings
// the same place back (POST /couple/places/{id}/restore).

import React, { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { get, post, del } from "@/lib/api";
import { failedText } from "@/features/shared/requests";
import { Button, Chip, ChipRow, Input, SectionLabel, Sheet, SheetActions, Skeleton, Stack, T, ToggleRow, toast, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";
import { PLACE_KINDS, type AppPlace } from "./core";
import { RUNSHEET_KEY } from "./hooks";

export const PLACES_KEY = ["couple-places"];

type Form = { name: string; kind: string; address: string; maps_link: string; notes: string; show_on_site: boolean };
const EMPTY: Form = { name: "", kind: "ceremony", address: "", maps_link: "", notes: "", show_on_site: false };

const formOf = (p: AppPlace): Form => ({
  name: p.name,
  kind: p.kind,
  address: p.address,
  maps_link: p.maps_link ?? "",
  notes: p.note ?? "",
  show_on_site: p.show_on_site,
});

/** `editing`: a place id, "new", or null (closed). */
export function PlaceSheet({ editing, onClose }: { editing: string | "new" | null; onClose: () => void }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: PLACES_KEY,
    queryFn: () => get<{ pending: boolean; places: AppPlace[] }>("/couple/places"),
    enabled: !!editing && editing !== "new",
  });
  const current = editing && editing !== "new" ? list.data?.places.find((p) => p.id === editing) ?? null : null;
  const [draft, setDraft] = useState<{ key: string; form: Form } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const key = editing ?? "";
  const form: Form | null = draft && draft.key === key ? draft.form : editing === "new" ? EMPTY : current ? formOf(current) : null;
  const set = (patch: Partial<Form>) => form && setDraft({ key, form: { ...form, ...patch } });

  function close() {
    setDraft(null);
    setError(null);
    onClose();
  }

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: RUNSHEET_KEY });
    void qc.invalidateQueries({ queryKey: PLACES_KEY });
  };

  async function save() {
    if (!form || !editing) return;
    if (!form.name.trim()) return setError(c.errorPlaceName);
    setError(null);
    setBusy("save");
    const body = {
      name: form.name.trim(),
      kind: form.kind,
      address: form.address.trim(),
      notes: form.notes.trim(),
      maps_link: form.maps_link.trim() || null,
      // Getting-ready places never show on the site (the server checks too).
      show_on_site: form.kind === "getting_ready" ? false : form.show_on_site,
    };
    try {
      const res = await post<{ place: AppPlace }>(editing === "new" ? "/couple/places" : `/couple/places/${editing}`, body);
      refresh();
      close();
      toast(fmt(c.placeSaved, { name: res.place.name }));
    } catch (err) {
      // A field the server refused stays inline under the form.
      setError(failedText(c.fail.savePlace, err, lang));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!current) return;
    const place = current;
    setBusy("delete");
    try {
      await del(`/couple/places/${place.id}`);
      refresh();
      close();
      toast(fmt(c.placeDeleted, { name: place.name }), {
        undo: () => {
          void post(`/couple/places/${place.id}/restore`)
            .then(refresh)
            .catch((err) => toastError(failedText(fmt(c.fail.restorePlace, { name: place.name }), err, lang)));
        },
      });
    } catch (err) {
      toastError(failedText(fmt(c.fail.deletePlace, { name: place.name }), err, lang));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      visible={!!editing}
      onClose={close}
      top={120}
      footer={form ? <SheetActions onCancel={close} onSave={save} saveLabel={c.savePlace} saving={busy === "save"} disabled={!!busy} saveTestID="place-save" /> : undefined}
    >
      <T v="title26">{editing === "new" ? c.addPlace : c.editPlace}</T>
      {!form ? (
        <Skeleton h={320} r={18} style={{ marginTop: 16 }} />
      ) : (
        <Stack gap={14} style={{ marginTop: 14 }}>
          <View>
            <SectionLabel>{c.placeName}</SectionLabel>
            <Input accessibilityLabel={c.placeName} value={form.name} onChangeText={(t) => set({ name: t.slice(0, 120) })} style={{ marginTop: 6 }} testID="place-name" />
          </View>
          <View>
            <SectionLabel>{c.placeKind}</SectionLabel>
            <View style={{ marginTop: 6 }}>
              <ChipRow>
                {PLACE_KINDS.map((k) => (
                  <Chip key={k} label={c.placeKinds[k]} on={form.kind === k} onPress={() => set({ kind: k })} />
                ))}
              </ChipRow>
            </View>
          </View>
          <View>
            <SectionLabel>{c.address}</SectionLabel>
            <Input accessibilityLabel={c.address} value={form.address} onChangeText={(t) => set({ address: t.slice(0, 300) })} multiline style={{ marginTop: 6, minHeight: 64, alignItems: "flex-start", paddingTop: 12 }} />
          </View>
          <View>
            <SectionLabel>{c.mapLink}</SectionLabel>
            <Input
              accessibilityLabel={c.mapLink}
              value={form.maps_link}
              onChangeText={(t) => set({ maps_link: t.trim().slice(0, 2000) })}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://"
              style={{ marginTop: 6 }}
            />
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
              {c.mapLinkHint}
            </T>
          </View>
          <View>
            <SectionLabel>{c.placeNotes}</SectionLabel>
            <Input accessibilityLabel={c.placeNotes} value={form.notes} onChangeText={(t) => set({ notes: t.slice(0, 500) })} multiline style={{ marginTop: 6, minHeight: 64, alignItems: "flex-start", paddingTop: 12 }} />
          </View>
          {form.kind === "getting_ready" ? (
            <T v="meta13" color={colors.ivory55}>
              {c.gettingReadyHidden}
            </T>
          ) : (
            <ToggleRow label={c.showOnSite} value={form.show_on_site} onChange={(v) => set({ show_on_site: v })} />
          )}
          {error ? (
            <T v="body15" color={colors.red} accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : null}
          {current ? <Button label={c.deletePlace} kind="ghost" onPress={remove} loading={busy === "delete"} disabled={!!busy} /> : null}
        </Stack>
      )}
    </Sheet>
  );
}
