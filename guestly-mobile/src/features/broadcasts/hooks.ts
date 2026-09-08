import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

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

export type TemplateSummary = { key: string; label: string; vars: string[]; preview: Record<Lang, string> };

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
};

export type Composition = {
  audience: AudienceFilter;
  template_key: string | null;
  custom_message: string | null;
  lang: Lang | "auto";
  template_vars: Record<string, string>;
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
};

export const useBroadcasts = () => useQuery({ queryKey: ["broadcasts"], queryFn: () => get<BroadcastSurface>("/couple/broadcasts") });
export const useBroadcast = (id: string) =>
  useQuery({ queryKey: ["broadcasts", id], queryFn: () => get<{ group: HistoryGroup; ledger_available: boolean }>(`/couple/broadcasts/${id}`), enabled: !!id });
export const usePlannerBroadcasts = () => useQuery({ queryKey: ["planner-broadcasts"], queryFn: () => get<PlannerBroadcasts>("/planner/broadcasts") });

export const previewBroadcast = (c: Composition) => post<Preview>("/couple/broadcasts/preview", c);
export const sendBroadcast = (c: Composition, confirm: string) => post<SendResult>("/couple/broadcasts", { ...c, confirm });
