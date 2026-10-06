// Template requests (build 13), shared by the couple's Broadcast tab and the
// planner's Broadcast screen: the list with status pills and the Guest-ly
// team's note, a detail sheet (edit while it waits on the requester, cancel
// while it is open) and the request form as a keyboard-safe sheet.
//
// A request never makes anything sendable. The Guest-ly team builds the
// template with WhatsApp; only then does it show up under "Your templates".
// What people type here is plain text for that team, never sent to guests.

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { errorText } from "@/features/shared/requests";
import { Badge, Banner, Button, Card, Chip, Field, Input, ListRow, Sheet, SheetActions, Stack, T, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";
import {
  OPEN_REQUEST_STATUSES,
  TEMPLATE_REQUEST_KINDS,
  cancelTemplateRequest,
  createTemplateRequest,
  updateTemplateRequest,
  type Lang,
  type TemplateRequestBody,
  type TemplateRequestKind,
  type TemplateRequestStatus,
  type TemplateRequestSummary,
} from "./hooks";

type Surface = "couple" | "planner";
type C = (typeof COPY)["en"];

const LIMITS = { title: 80, purpose: 600, when: 200, draft: 1000 };
/** The portal refuses a 4th open request per wedding (`too_many_open`). */
export const MAX_OPEN_REQUESTS = 3;

export function isOpenRequest(r: TemplateRequestSummary): boolean {
  return (OPEN_REQUEST_STATUSES as string[]).includes(r.status);
}

/** Edits are allowed while the request waits on the requester, and only
 *  when the portal says this person owns it. */
function editable(r: TemplateRequestSummary): boolean {
  return r.editable !== false && (r.status === "submitted" || r.status === "needs_info");
}

function statusKind(status: string): "green" | "amber" | "gold" | "mute" | "red" {
  if (status === "approved") return "green";
  if (status === "needs_info") return "amber";
  if (status === "rejected") return "red";
  if (status === "cancelled") return "mute";
  return "gold";
}

export function RequestStatusBadge({ status }: { status: string }) {
  const c = useFeatureCopy(COPY);
  const label = (c.status as Record<string, string>)[status] ?? status;
  return <Badge label={label} kind={statusKind(status)} />;
}

export function kindLabel(c: C, kind: string): string {
  return (c.kinds as Record<string, string>)[kind] ?? (c.kinds as Record<string, string>).other;
}

/** "English, Spanish" / "Inglés, español". */
export function languageList(c: C, langs: Lang[]): string {
  const s = langs.map((l) => c.langNames[l]).join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The list: one row per request (title, kind, when, status pill) with the
 *  team's note under it. Tapping a row opens its detail. */
export function TemplateRequestList({ requests, onOpen }: { requests: TemplateRequestSummary[]; onOpen: (r: TemplateRequestSummary) => void }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  return (
    <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
      {requests.map((r, i) => (
        <ListRow
          key={r.id}
          testID={`template-request-${r.id}`}
          title={r.title}
          sub={`${kindLabel(c, r.kind)} · ${relTime(r.updated_at || r.created_at, lang)}`}
          trailing={<RequestStatusBadge status={r.status} />}
          below={
            r.ops_note ? (
              <View style={{ marginTop: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: r.status === "needs_info" ? colors.amber : colors.goldBorder }}>
                <T v="meta13" color={colors.ivory70} numberOfLines={3}>
                  {r.ops_note}
                </T>
              </View>
            ) : undefined
          }
          onPress={() => onOpen(r)}
          last={i === requests.length - 1}
        />
      ))}
    </Card>
  );
}

/** Detail of one request, with Edit and Cancel when they apply. */
export function TemplateRequestDetail({
  request,
  surface,
  invalidate,
  onClose,
  onEdit,
}: {
  request: TemplateRequestSummary | null;
  surface: Surface;
  /** Query keys to refetch after a change. */
  invalidate: string[];
  onClose: () => void;
  onEdit: (r: TemplateRequestSummary) => void;
}) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = request;

  function confirmCancel() {
    if (!r || busy) return;
    Alert.alert(c.requestCancelTitle, c.requestCancelBody, [
      { text: c.requestKeep, style: "cancel" },
      { text: c.requestCancel, style: "destructive", onPress: () => void doCancel(r) },
    ]);
  }

  async function doCancel(req: TemplateRequestSummary) {
    setBusy(true);
    setError(null);
    try {
      await cancelTemplateRequest(surface, req.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
      toast(c.requestCancelled, { icon: "check" });
    } catch (err) {
      setError(errorText(err, lang, c.formFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={!!r} onClose={() => (busy ? null : (setError(null), onClose()))} top={160}>
      {r ? (
        <Stack gap={12} style={{ paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <RequestStatusBadge status={r.status} />
            <T v="meta13" color={colors.ivory55}>
              {kindLabel(c, r.kind)}
            </T>
          </View>
          <T v="title26">{r.title}</T>
          <T v="meta13" color={colors.ivory55}>
            {[fmt(c.requestSentOn, { when: relTime(r.created_at, lang) }), r.updated_at && r.updated_at !== r.created_at ? fmt(c.requestUpdated, { when: relTime(r.updated_at, lang) }) : null, languageList(c, r.languages ?? [])].filter(Boolean).join(" · ")}
          </T>
          {r.ops_note ? (
            <Card kind="solid" padding={14} border={r.status === "needs_info" ? colors.amber : colors.goldBorder}>
              <T v="label11" color={r.status === "needs_info" ? colors.amber : colors.goldLight} style={{ letterSpacing: 1 }}>
                {c.teamNote.toUpperCase()}
              </T>
              <T v="body15" color={colors.ivory90} style={{ marginTop: 6 }}>
                {r.ops_note}
              </T>
            </Card>
          ) : null}
          {r.purpose ? <Detail label={c.formPurpose} text={r.purpose} /> : null}
          {r.send_when ? <Detail label={c.formWhen} text={r.send_when} /> : null}
          {r.draft_en ? <Detail label={c.formDraftEn} text={r.draft_en} /> : null}
          {r.draft_es ? <Detail label={c.formDraftEs} text={r.draft_es} /> : null}
          {error ? <Banner icon="warning" title={error} kind="red" /> : null}
          {editable(r) ? <Button label={c.requestEdit} icon="edit" kind="glass" onPress={() => onEdit(r)} disabled={busy} testID="template-request-edit" /> : null}
          {isOpenRequest(r) && r.editable !== false ? <Button label={c.requestCancel} kind="text" onPress={confirmCancel} loading={busy} disabled={busy} testID="template-request-cancel" /> : null}
          <Button label={c.close} kind="ghost" onPress={onClose} disabled={busy} />
        </Stack>
      ) : null}
    </Sheet>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ gap: 4 }}>
      <T v="meta13" color={colors.ivory55}>
        {label}
      </T>
      <T v="body15" color={colors.ivory90}>
        {text}
      </T>
    </View>
  );
}

type Form = { kind: TemplateRequestKind; title: string; purpose: string; when: string; draftEn: string; draftEs: string; languages: Lang[] };

function formFrom(r: TemplateRequestSummary | null, preset?: TemplateRequestKind | null): Form {
  const kind = (TEMPLATE_REQUEST_KINDS as string[]).includes(r?.kind ?? "") ? (r!.kind as TemplateRequestKind) : preset ?? "other";
  const langs = (r?.languages ?? []).filter((l): l is Lang => l === "en" || l === "es");
  return {
    kind,
    title: r?.title ?? "",
    purpose: r?.purpose ?? "",
    when: r?.send_when ?? "",
    draftEn: r?.draft_en ?? "",
    draftEs: r?.draft_es ?? "",
    languages: langs.length ? langs : ["en", "es"],
  };
}

/** Strips control characters (newlines stay in the long fields). */
function clean(s: string, multiline: boolean): string {
  const out = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "") : s.replace(/[\u0000-\u001F\u007F]/g, " ");
  return out.trim();
}

/** The request form. `editing` set: edits that request (the portal replaces
 *  the whole request, so the full form is sent; editing one that needs info
 *  sends it back to the team). */
export function TemplateRequestSheet({
  visible,
  surface,
  editing,
  presetKind,
  invalidate,
  onClose,
}: {
  visible: boolean;
  surface: Surface;
  editing: TemplateRequestSummary | null;
  presetKind?: TemplateRequestKind | null;
  invalidate: string[];
  onClose: () => void;
}) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(() => formFrom(editing, presetKind));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A fresh form each time the sheet opens (or opens on another request).
  const openKey = visible ? `${editing?.id ?? "new"}:${presetKind ?? ""}` : "";
  const [seenKey, setSeenKey] = useState(openKey);
  if (openKey !== seenKey) {
    setSeenKey(openKey);
    if (openKey) {
      const f = formFrom(editing, presetKind);
      setForm(f);
      setError(null);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleLang = (l: Lang) => set("languages", form.languages.includes(l) ? form.languages.filter((x) => x !== l) : [...form.languages, l].sort());

  async function submit() {
    if (busy) return;
    const title = clean(form.title, false).slice(0, LIMITS.title);
    const purpose = clean(form.purpose, true).slice(0, LIMITS.purpose);
    if (!title || !purpose) return setError(c.formMissing);
    if (!form.languages.length) return setError(c.formLangMissing);
    const body: TemplateRequestBody = {
      kind: form.kind,
      title,
      purpose,
      languages: form.languages,
      send_when: clean(form.when, false).slice(0, LIMITS.when) || undefined,
      draft_en: form.languages.includes("en") ? clean(form.draftEn, true).slice(0, LIMITS.draft) || undefined : undefined,
      draft_es: form.languages.includes("es") ? clean(form.draftEs, true).slice(0, LIMITS.draft) || undefined : undefined,
    };
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateTemplateRequest(surface, editing.id, body);
      } else {
        await createTemplateRequest(surface, body);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
      toast(editing ? c.formSaved : c.formSent, { icon: "check" });
    } catch (err) {
      // too_many_open, rate_limited and field errors arrive as bilingual
      // sentences from the portal.
      setError(errorText(err, lang, c.formFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => (busy ? null : onClose())}
      top={70}
      footer={<SheetActions onCancel={onClose} onSave={() => void submit()} saving={busy} saveLabel={editing ? c.formSave : c.formSend} saveTestID="template-request-submit" />}
    >
      <Stack gap={16} style={{ paddingHorizontal: 4 }}>
        <View style={{ gap: 6 }}>
          <T v="title26">{editing ? c.formEditTitle : c.formTitle}</T>
          <T v="body15" color={colors.ivory70}>
            {c.formLead}
          </T>
        </View>
        <Field label={c.formKind}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8 }}>
            {TEMPLATE_REQUEST_KINDS.map((k) => (
              <Chip key={k} label={kindLabel(c, k)} on={form.kind === k} onPress={() => set("kind", k)} testID={`template-kind-${k}`} />
            ))}
          </View>
        </Field>
        <Field label={c.formName}>
          <Input value={form.title} onChangeText={(t) => set("title", t.slice(0, LIMITS.title))} placeholder={c.formNamePlaceholder} maxLength={LIMITS.title} returnKeyType="next" testID="template-request-title" />
        </Field>
        <Field label={c.formPurpose}>
          <Input value={form.purpose} onChangeText={(t) => set("purpose", t.slice(0, LIMITS.purpose))} placeholder={c.formPurposePlaceholder} maxLength={LIMITS.purpose} multiline style={{ minHeight: 110, alignItems: "flex-start", paddingTop: 12 }} testID="template-request-purpose" />
        </Field>
        <Field label={c.formWhen}>
          <Input value={form.when} onChangeText={(t) => set("when", t.slice(0, LIMITS.when))} placeholder={c.formWhenPlaceholder} maxLength={LIMITS.when} />
        </Field>
        <Field label={c.formLanguages}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8 }}>
            {(["en", "es"] as const).map((l) => (
              <Chip key={l} label={languageList(c, [l])} on={form.languages.includes(l)} onPress={() => toggleLang(l)} testID={`template-lang-${l}`} />
            ))}
          </View>
        </Field>
        {form.languages.includes("en") ? (
          <Field label={c.formDraftEn}>
            <Input value={form.draftEn} onChangeText={(t) => set("draftEn", t.slice(0, LIMITS.draft))} placeholder={c.formDraftPlaceholder} maxLength={LIMITS.draft} multiline style={{ minHeight: 96, alignItems: "flex-start", paddingTop: 12 }} />
          </Field>
        ) : null}
        {form.languages.includes("es") ? (
          <Field label={c.formDraftEs}>
            <Input value={form.draftEs} onChangeText={(t) => set("draftEs", t.slice(0, LIMITS.draft))} placeholder={c.formDraftPlaceholder} maxLength={LIMITS.draft} multiline style={{ minHeight: 96, alignItems: "flex-start", paddingTop: 12 }} />
          </Field>
        ) : null}
        {error ? <Banner icon="warning" title={error} kind="red" /> : null}
      </Stack>
    </Sheet>
  );
}

/** Everything a screen needs for requests: the list section and its sheets.
 *  Renders nothing when the portal did not send `template_requests` (a
 *  portal from before build 13). */
export function useTemplateRequests({ surface, requests, canRequest, invalidate }: { surface: Surface; requests: TemplateRequestSummary[] | undefined; canRequest: boolean; invalidate: string[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [presetKind, setPresetKind] = useState<TemplateRequestKind | null>(null);
  const [editing, setEditing] = useState<TemplateRequestSummary | null>(null);
  const [detail, setDetail] = useState<TemplateRequestSummary | null>(null);
  const list = requests ?? [];
  const openCount = list.filter(isOpenRequest).length;
  const atLimit = openCount >= MAX_OPEN_REQUESTS;
  const supported = Array.isArray(requests);

  function openForm(kind?: TemplateRequestKind | null) {
    setEditing(null);
    setPresetKind(kind ?? null);
    setFormOpen(true);
  }

  const sheets = supported ? (
    <>
      <TemplateRequestDetail
        request={detail}
        surface={surface}
        invalidate={invalidate}
        onClose={() => setDetail(null)}
        onEdit={(r) => {
          setDetail(null);
          // Let the detail sheet close before the form opens.
          setTimeout(() => {
            setEditing(r);
            setPresetKind(null);
            setFormOpen(true);
          }, 260);
        }}
      />
      <TemplateRequestSheet visible={formOpen} surface={surface} editing={editing} presetKind={presetKind} invalidate={invalidate} onClose={() => setFormOpen(false)} />
    </>
  ) : null;

  return { supported, canRequest: supported && canRequest, atLimit, list, openForm, openDetail: setDetail, sheets };
}

export type { TemplateRequestStatus };
