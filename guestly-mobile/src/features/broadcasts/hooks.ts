import { useQuery } from "@tanstack/react-query";
import { api, get, post } from "@/lib/api";
import { postLong, postOnce } from "@/features/shared/requests";

export type Lang = "en" | "es";
export type RsvpState = "attending" | "declined" | "pending" | "none";

export type BroadcastGuest = {
  id: string;
  name: string;
  tags: string[];
  lang: Lang;
  lang_source: "explicit" | "phone" | "default";
  rsvp: RsvpState;
  has_phone: boolean;
};

export type AudienceFilter =
  | { type: "all" }
  | { type: "status"; status: RsvpState }
  | { type: "tag"; tag: string }
  | { type: "language"; language: Lang }
  | { type: "guests"; guest_ids: string[] };

export type AudienceOption = {
  key: string;
  filter: AudienceFilter;
  label: { en: string; es: string };
  count: number;
  skipped_no_phone: number;
};

/** One approved template this wedding can send. Build 13 (per-wedding
 *  templates): the portal lists only sendable ones and adds id, version,
 *  languages, simulated and category. A portal from before build 13 sends
 *  only key, label, vars and preview, so every new field is optional and read
 *  through the helpers below. */
export type TemplateSummary = {
  key: string;
  label: string;
  vars: string[];
  preview: Partial<Record<Lang, string>>;
  id?: string;
  version?: number;
  languages?: Lang[];
  /** Demo wedding (App Review): recorded, never delivered. */
  simulated?: boolean;
  category?: string;
};

/** The languages a template can go out in: the portal's list, else the
 *  languages its preview has text for (older portal). */
export function templateLanguages(t: TemplateSummary): Lang[] {
  const listed = Array.isArray(t.languages) ? t.languages.filter((l): l is Lang => l === "en" || l === "es") : [];
  if (listed.length) return listed;
  return (["en", "es"] as const).filter((l) => typeof t.preview?.[l] === "string" && !!t.preview[l]?.trim());
}

export type TemplateRequestKind = "rsvp_closing" | "transport" | "thank_you" | "schedule_change" | "welcome" | "meal_choice" | "other";
export const TEMPLATE_REQUEST_KINDS: TemplateRequestKind[] = ["rsvp_closing", "transport", "thank_you", "schedule_change", "welcome", "meal_choice", "other"];
export type TemplateRequestStatus = "submitted" | "in_review" | "needs_info" | "with_whatsapp" | "approved" | "rejected" | "cancelled";
/** A request still in play (counts toward the portal's 3 open per wedding). */
export const OPEN_REQUEST_STATUSES: TemplateRequestStatus[] = ["submitted", "in_review", "needs_info", "with_whatsapp"];

export type TemplateRequestSummary = {
  id: string;
  kind: TemplateRequestKind | string;
  title: string;
  status: TemplateRequestStatus | string;
  /** The Guest-ly team's note to the requester (plain text). */
  ops_note: string | null;
  languages: Lang[];
  created_at: string;
  updated_at: string;
  /** Present when the portal returns the full request (create, edit). */
  purpose?: string | null;
  send_when?: string | null;
  draft_en?: string | null;
  draft_es?: string | null;
  /** Whether this person may edit or cancel it (a couple cannot change a
   *  request their planner filed). Absent on older portals. */
  editable?: boolean;
};

export type TemplateRequestBody = {
  kind: TemplateRequestKind;
  title: string;
  purpose: string;
  send_when?: string;
  draft_en?: string;
  draft_es?: string;
  languages: Lang[];
};

export type DeliveryRollup = { delivered: number; read: number; failed: number; pending: number; total: number };

export type HistoryGroup =
  | {
      groupKind: "campaign";
      id: string;
      ts: string;
      label: string;
      customMessage: string | null;
      audience: number;
      sent: number;
      failed: number;
      langBreakdown: Partial<Record<Lang, { total: number; sent: number; failed: number }>> | null;
      recipients: { id: string | null; name: string; lang: string; ok: boolean }[] | null;
      delivery: DeliveryRollup | null;
    }
  | { groupKind: "aggregate"; id: string; ts: string; label: string | null; count: number; delivery: DeliveryRollup | null };

export type BroadcastSurface = {
  can_send: boolean;
  /** False until this wedding has an approved template (build 13). Missing
   *  on an older portal: read as "ready when any template is listed". */
  templates_ready?: boolean;
  /** Build 13: the couple can ask Guest-ly for a new template. */
  can_request_template?: boolean;
  /** Build 13: open requests plus the last closed ones, newest first. */
  template_requests?: TemplateRequestSummary[];
  guests: BroadcastGuest[];
  audiences: AudienceOption[];
  templates: TemplateSummary[];
  history: HistoryGroup[];
  ledger_available: boolean;
  sent_last_24h: number;
};

export type PlannerBroadcasts = {
  audiences: AudienceOption[];
  templates: TemplateSummary[];
  history: HistoryGroup[];
  ledger_available: boolean;
  guests_with_phone: number;
  guests_without_phone: number;
  /** Build 13 (missing on an older portal). */
  can_request_template?: boolean;
  template_requests?: TemplateRequestSummary[];
};

export type Composition = {
  audience: AudienceFilter;
  template_key: string | null;
  custom_message: string | null;
  lang: Lang | "auto";
  template_vars: Record<string, string>;
  /** Build 13: the template as the person saw it. A portal that knows these
   *  answers 409 `template_changed` (nothing sent) when it was edited since;
   *  an older one ignores them. */
  template_id?: string;
  template_version?: number;
};

export type Preview = {
  recipients_count: number;
  skipped_no_phone: number;
  by_lang: Record<Lang, number>;
  recipients: { id: string; name: string; lang: Lang }[];
  sample: Partial<Record<Lang, string>>;
};

export type SendResult = {
  summary: { total: number; sent: number; failed: number };
  by_lang: Partial<Record<Lang, { total: number; sent: number; failed: number }>>;
  failed_batches: { lang: Lang; count: number; error: string }[];
  invalid: number;
  recipients_count: number;
  /** Build 13: the demo wedding records the send but delivers nothing. */
  simulated?: boolean;
};

export const useBroadcasts = () => useQuery({ queryKey: ["broadcasts"], queryFn: () => get<BroadcastSurface>("/couple/broadcasts") });
export const useBroadcast = (id: string) =>
  useQuery({ queryKey: ["broadcasts", id], queryFn: () => get<{ group: HistoryGroup; ledger_available: boolean }>(`/couple/broadcasts/${id}`), enabled: !!id });
export const usePlannerBroadcasts = () => useQuery({ queryKey: ["planner-broadcasts"], queryFn: () => get<PlannerBroadcasts>("/planner/broadcasts") });

// The preview may translate the custom text, so it gets the model timeout.
export const previewBroadcast = (c: Composition) => postLong<Preview>("/couple/broadcasts/preview", c);
/** `sendKey` is minted once per send attempt (the confirm sheet opening) and
 *  reused on any retry of that attempt, so the portal can answer a replay with
 *  the first result instead of messaging every guest twice. */
export const sendBroadcast = (c: Composition, confirm: string, sendKey: string, expectedRecipients?: number) =>
  postOnce<SendResult>(
    "/couple/broadcasts",
    // `expected_recipients` (B1): the count the person confirmed. A portal that
    // knows it answers 409 `recipients_changed` and sends nothing when the live
    // audience differs; an older portal ignores the field.
    typeof expectedRecipients === "number" ? { ...c, confirm, expected_recipients: expectedRecipients } : { ...c, confirm },
    sendKey
  );

// ------------------------------------------------------------ template requests
// Build 13. A request never makes anything sendable: the Guest-ly team builds
// the template with WhatsApp and only then does it appear in `templates`.

type RequestSurface = "couple" | "planner";
const requestsPath = (surface: RequestSurface) => `/${surface}/template-requests`;

export const createTemplateRequest = (surface: RequestSurface, body: TemplateRequestBody) => post<{ request: TemplateRequestSummary }>(requestsPath(surface), body);
export const updateTemplateRequest = (surface: RequestSurface, id: string, body: Partial<TemplateRequestBody>) =>
  api<{ request: TemplateRequestSummary }>(`${requestsPath(surface)}/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const cancelTemplateRequest = (surface: RequestSurface, id: string) => post<{ request: TemplateRequestSummary }>(`${requestsPath(surface)}/${encodeURIComponent(id)}/cancel`, {});
