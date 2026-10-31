// One guest's thank-you note: the text (typed, or a draft the portal writes
// in the guest's language from the wedding details; the app never talks to a
// model), Copy, Save and Mark done. Nothing is ever sent from here.

import React, { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { usePane } from "@/ui/MasterDetail";
import { Screen, TopBar, BigTitle, Field, Input, Button, ButtonRow, Stack, T, Skeleton, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { THANKYOU_COPY } from "../copy";
import { THANKYOU_KEY, useThankyou, type ThankyouList } from "../hooks";

export function ThankyouNoteScreen({ id }: { id: string }) {
  const c = useFeatureCopy(THANKYOU_COPY);
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const pane = usePane();
  const qc = useQueryClient();
  const query = useThankyou();
  const item = query.data?.items.find((i) => i.guest_id === id) ?? null;
  const [text, setText] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed from the stored draft once per guest (two panes swap guests in place).
  if (item && seeded !== item.guest_id) {
    setSeeded(item.guest_id);
    setText(item.draft ?? "");
  }
  const value = text ?? "";
  const dirty = !!item && value.trim() !== (item.draft ?? "").trim();
  const leave = useUnsavedGuard(dirty);

  const patchItem = (p: { draft?: string | null; done?: boolean }) =>
    qc.setQueryData<ThankyouList>(THANKYOU_KEY, (d) => (d ? { ...d, items: d.items.map((i) => (i.guest_id === id ? { ...i, ...p } : i)) } : d));

  async function draft() {
    if (drafting) return;
    setDrafting(true);
    try {
      const r = await post<{ draft: string }>(`/couple/thankyou/${encodeURIComponent(id)}/draft`, {}, { timeoutMs: 45_000 });
      setText(r.draft);
      patchItem({ draft: r.draft });
    } catch (err) {
      toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
    } finally {
      setDrafting(false);
    }
  }

  async function save(extra: { done?: boolean } = {}) {
    if (saving) return;
    setSaving(true);
    const prev = qc.getQueryData<ThankyouList>(THANKYOU_KEY);
    patchItem({ draft: value.trim() || null, ...extra });
    try {
      await post(`/couple/thankyou/${encodeURIComponent(id)}`, { draft: value.trim() || null, ...extra });
      leave.release();
      toast(extra.done === true ? c.done : c.saved);
    } catch (err) {
      if (prev) qc.setQueryData(THANKYOU_KEY, prev);
      toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
    } finally {
      setSaving(false);
    }
  }

  async function copyText() {
    if (!value.trim()) return;
    await Clipboard.setStringAsync(value.trim());
    toast(c.copied);
  }

  return (
    <Screen query={query} header={<TopBar onBack={pane.embedded ? () => pane.select(null) : () => leave(back)} title={c.title} />} bottomInset={60} keyboard>
      {!item ? (
        <Stack gap={12} style={{ marginTop: 8 }}>
          <Skeleton h={40} w="60%" />
          <Skeleton h={180} r={16} />
        </Stack>
      ) : (
        <>
          <BigTitle title={item.party_names} sub={item.table ? fmt(c.table, { t: item.table }) : undefined} size={34} />
          <Stack gap={14} style={{ marginTop: 18 }}>
            <Field label={c.note} hint={c.draftHint}>
              <Input value={value} onChangeText={setText} placeholder={c.notePlaceholder} placeholderTextColor={colors.ivory40} multiline style={{ minHeight: 180 }} textAlignVertical="top" testID="thankyou-note" />
            </Field>
            <Button label={drafting ? c.drafting : value.trim() ? c.rewrite : c.write} kind="glass" icon="edit" onPress={() => void draft()} loading={drafting} testID="thankyou-draft" />
            <ButtonRow>
              <Button label={c.copy} kind="ghost" small icon="copy" onPress={() => void copyText()} disabled={!value.trim()} />
              <Button label={c.save} kind="ghost" small onPress={() => void save()} disabled={!dirty} loading={saving && !item.done} />
            </ButtonRow>
            <View>
              <Button label={item.done ? c.markTodo : c.markDone} kind={item.done ? "text" : "primary"} icon={item.done ? "undo" : "check"} onPress={() => void save({ done: !item.done })} testID="thankyou-done" />
            </View>
            {item.done ? (
              <T v="meta13" color={colors.greenText} center>
                {c.done}
              </T>
            ) : null}
          </Stack>
        </>
      )}
    </Screen>
  );
}
