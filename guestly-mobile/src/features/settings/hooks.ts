// Couple settings data.

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type Reminders = {
  enabled: boolean;
  offsets_days: number[];
  send_hour_start: number;
  send_hour_end: number;
  min_gap_days: number;
  tz: string;
  last_run_day: string | null;
};

export type CoupleSettings = {
  reminders: Reminders;
  reminders_pending: boolean;
  notifications: { rsvp_email: boolean; weekly_digest: boolean };
  invite_code: string | null;
  invite_url: string | null;
  wedding: { couple_names: string; wedding_date: string | null; slug: string; timezone: string; locale_default: string };
  can_edit: boolean;
};

export const SETTINGS_KEY = ["couple-settings"] as const;

export function useCoupleSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => get<CoupleSettings>("/couple/settings"), staleTime: 30_000 });
}

// ---------------------------------------------------------------- HH wave F
// The Settings area (portal hh/f-app-api, docs/mobile-api.md "Settings").
// Every read is the web Settings page's loader; every write runs the web
// Settings action, so the roles and validators are the web ones.

export type Lang = "en" | "es";
export type SettingsSurface = "couple" | "planner";

export type GeneralSettings = {
  couple_names: string;
  wedding_date: string | null;
  wedding_city: string | null;
  venue_booked: boolean;
  timezone: string;
  locale_default: Lang;
  can_edit: boolean;
};

export type Profile = {
  first_name: string;
  last_name: string;
  lang: Lang;
  timezone: string;
  email: string;
  marketing_consent: boolean;
  unsubscribed: boolean;
  marketing_consent_at: string | null;
  marketing_consent_source: string | null;
};

export type PrefChannel = "email" | "push" | "bell";
export type PrefEventRow = {
  key: string;
  label: string;
  hint: string;
  channels: Partial<Record<PrefChannel, boolean>>;
  mode?: "instant" | "daily";
};
export type Prefs = {
  surface: SettingsSurface;
  available: boolean;
  can_edit: boolean;
  events: PrefEventRow[];
  rsvp_mode: "instant" | "daily";
  daily_available: boolean;
  quiet_hours: { start: number; end: number } | null;
  marketing: { event: string; consent: boolean; unsubscribed: boolean };
  weddings_count: number;
};
export type PrefsChange =
  | { event: string; channel: PrefChannel; enabled: boolean; scope?: "wedding" | "all" }
  | { event: "rsvp_new"; mode: "instant" | "daily"; scope?: "wedding" | "all" }
  | { quiet_hours: { start: number; end: number } | null; scope?: "wedding" | "all" }
  | { marketing: boolean };

export type TeamRole = "owner" | "admin" | "viewer" | "planner";
export type TeamMember = { user_id: string; name: string; email_masked: string; role: TeamRole; is_me: boolean; last_seen_at: string | null; removable: boolean };
export type TeamInvite = { id: string; email_masked: string; first_name: string | null; role: "admin" | "viewer"; lang: Lang; status: "pending" | "accepted" | "revoked" | "expired"; created_at: string; expires_at: string };
export type Team = { members: TeamMember[]; invites: TeamInvite[]; invites_pending: boolean; can_invite: boolean };
export type PlannerTeam = { agency: { name: string }; members: { user_id: string; email_masked: string; level: string; is_me: boolean; created_at: string | null }[] };

export type MaintenanceState = "none" | "included" | "final_month" | "ended" | "subscribed";
export type Billing = {
  tier: string;
  tier_label: string | null;
  plan: { id: string; name: string; price_usd: number; coordinator_included: boolean } | null;
  agreed_price: string | null;
  coordinator: boolean;
  used: number;
  cap: number | null;
  cap_label: string | null;
  over: number;
  live_until: string | null;
  maintenance: { state: MaintenanceState | string; monthly_usd: number; keep_live_url: string | null };
  upgrade_links: { tier: string; plan_id: string; name: string; price_usd: number; url: string; self_serve: boolean }[];
};
export type PlannerBilling = { agency: { name: string }; seats: number; live: number; building: number; archived: number };

export type ConnectionStatus = "connected" | "needs_attention" | "not_set_up";
export type ConnectionItem = {
  provider: string;
  category: string;
  name: string;
  status: ConnectionStatus;
  reason_code: string;
  reason: string;
  scope: string;
  action_by: "couple" | "guestly" | "none";
  last_ok_at: string | null;
  address?: string;
  domain?: string;
};
export type Connections = { items: ConnectionItem[]; categories: { key: string; name: string }[]; summary: Record<ConnectionStatus, number> };

export type Referral = { available: boolean; code: string | null; url: string | null; joined: number | null; paid: number | null; reward_line: string | null };

export const GENERAL_KEY = ["settings-general"] as const;
export const PROFILE_KEY = ["me-profile"] as const;
export const PREFS_KEY = ["me-prefs"] as const;
export const TEAM_KEY = ["couple-team"] as const;
export const BILLING_KEY = ["settings-billing"] as const;
export const CONNECTIONS_KEY = ["settings-connections"] as const;
export const REFERRAL_KEY = ["couple-referral"] as const;

export function useGeneralSettings(surface: SettingsSurface = "couple") {
  return useQuery({ queryKey: [...GENERAL_KEY, surface], queryFn: () => get<GeneralSettings>(`/${surface}/settings/general`), staleTime: 30_000 });
}

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => get<Profile>("/me/profile"), staleTime: 30_000 });
}

export function usePrefs() {
  return useQuery({ queryKey: PREFS_KEY, queryFn: () => get<Prefs>("/me/prefs"), staleTime: 30_000 });
}

export function useTeam(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: TEAM_KEY, queryFn: () => get<Team>("/couple/team"), staleTime: 30_000, enabled: opts.enabled ?? true });
}

export function usePlannerTeam(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["planner-team"], queryFn: () => get<PlannerTeam>("/planner/team"), staleTime: 60_000, retry: false, enabled: opts.enabled ?? true });
}

export function useBilling(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: BILLING_KEY, queryFn: () => get<Billing>("/couple/billing"), staleTime: 60_000, enabled: opts.enabled ?? true });
}

export function usePlannerBilling(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["planner-billing"], queryFn: () => get<PlannerBilling>("/planner/billing"), staleTime: 60_000, retry: false, enabled: opts.enabled ?? true });
}

export function useConnections(surface: SettingsSurface = "couple") {
  return useQuery({ queryKey: [...CONNECTIONS_KEY, surface], queryFn: () => get<Connections>(`/${surface}/connections`), staleTime: 60_000 });
}

export function useReferral(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: REFERRAL_KEY, queryFn: () => get<Referral>("/couple/referral"), staleTime: 5 * 60_000, enabled: opts.enabled ?? true });
}
