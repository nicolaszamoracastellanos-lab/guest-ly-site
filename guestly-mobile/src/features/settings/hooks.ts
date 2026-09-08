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
