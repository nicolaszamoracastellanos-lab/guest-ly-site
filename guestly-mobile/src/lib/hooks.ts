// Typed queries over the mobile API. Keys in PERSISTED (lib/query) are cached
// to disk so the home screens open instantly offline.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

// ---- guest
export type ScheduleEvent = {
  id: string; title: string; date: string | null; time: string | null; start_minutes: number | null;
  location: string | null; address_note: string | null; maps_url: string | null; dress_code: string | null;
  notes: string | null; ics_url: string; invited: boolean;
};
export type RsvpSummary = {
  status: "attending" | "declined" | "pending"; answers: Record<string, "attending" | "declined">;
  party_size: number | null; max_party: number; responded_at: string | null; deadline: string | null;
  deadline_passed: boolean; can_edit: boolean;
};
export type GuestHome = {
  guest: { id: string; name: string; language: string | null };
  couple_names: string; wedding_date: string | null; city: string | null; hero_image_url: string | null;
  countdown: { days: number; hours: number; minutes: number; passed: boolean } | null;
  day_of: boolean; rsvp: RsvpSummary; next_event: ScheduleEvent | null; dress_code: string | null;
  quick_links: { schedule_count: number; directions_url: string | null; dress_code: boolean; concierge_live: boolean };
};
export type DayOf = {
  available: boolean; now_local: { day: string; hour: number; minute: number };
  current: ScheduleEvent | null; next: ScheduleEvent | null;
  events: (ScheduleEvent & { state: "done" | "now" | "next" | "later" })[];
  dress_code: string | null; getting_there: string | null; planner_whatsapp: string | null;
};
export type GuestPayload = {
  guestToken: string; displayName: string; maxParty: number; members: string[]; language: string | null;
  hasContact: boolean; events: { id: string; title: { en: string; es: string }; date: string | null; time: string | null; location: string | null; cost: string | null }[];
  questions: { id: string; label: { en: string | null; es: string | null }; type: string; required?: boolean; options?: { id: string; label: { en: string | null; es: string | null } }[]; event_id: string | null }[];
  existing: { answers: Record<string, string>; questionAnswers: Record<string, string>; partySize: number | null; companions: { name: string | null; attending: boolean; main?: boolean; events?: Record<string, string> }[]; notes: string | null; respondedAt: string | null } | null;
};
export type ThreadMessage = { id: string; role: "guest" | "bot" | "couple"; text: string; created_at: string; needs_couple: boolean; replied_at: string | null };

export const useGuestHome = () => useQuery({ queryKey: ["guest-home"], queryFn: () => get<GuestHome>("/guest/home") });
export const useGuestSchedule = () => useQuery({ queryKey: ["guest-schedule"], queryFn: () => get<{ wedding_date: string | null; timezone: string; events: ScheduleEvent[]; arrival_advice: string | null }>("/guest/schedule") });
export const useGuestDayOf = () => useQuery({ queryKey: ["guest-dayof"], queryFn: () => get<DayOf>("/guest/dayof"), refetchInterval: 60_000 });
export const useGuestRsvp = () => useQuery({ queryKey: ["guest-rsvp"], queryFn: () => get<{ payload: GuestPayload; summary: RsvpSummary }>("/guest/rsvp") });
export const useGuestMessages = () => useQuery({ queryKey: ["guest-messages"], queryFn: () => get<{ pending: boolean; conversation_id?: string; messages: ThreadMessage[] }>("/guest/messages"), refetchInterval: 30_000 });

// ---- couple
export type Totals = { parties: number; people_expected: number; attending_parties: number; attending_seats: number; declined_parties: number; declined_seats: number; pending_parties: number };
export type CoupleHome = {
  couple_names: string; wedding_date: string | null; countdown: { days: number; hours: number; minutes: number; passed: boolean } | null;
  day_of: boolean; concierge_live: boolean; briefing: { text: string; href: string; tone: "risk" | "warn" | "info" }[];
  needs_you: number; totals: Totals; budget_percent_paid: number | null;
};
export type GuestListItem = { id: string; name: string; initials: string; party_size: number; tags: string[]; status: "attending" | "declined" | "pending"; checked_in_at: string | null; language: string | null };
export type RsvpListItem = { id: string; guest_id: string | null; name: string; initials: string; status: "attending" | "declined" | "pending"; party_size: number | null; seats_answered: string; channel: string | null; source: string | null; updated_at: string | null };
export type InboxItem = { id: string; channel: string; name: string; initials: string; preview: string; last_at: string; needs_you: boolean; upset: boolean; guest_id: string | null };
export type CoupleDayOf = {
  day_of: boolean; parties_in: number; parties_total: number; seats_in: number; seats_total: number;
  runsheet: { id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; owner: string | null; state: "done" | "now" | "next" | "later" }[];
  runsheet_available: boolean; escalations: { id: string; text: string; source: string; at: string | null }[];
};
export type MoreEntry = { key: string; available: boolean; count: number | null; note: string | null };
export type GuestDetail = {
  detail: {
    id: string; name: string; partySize: number; members: string[]; tags: string[]; language: "en" | "es" | null;
    createdAt: string | null; lastRemindedAt: string | null; checkedInAt: string | null; notes: string | null;
    rsvp: { id: string; status: string; partySize: number | null; updatedAt: string | null; notes: string | null } | null;
    events: { id: string; title: string; answer: string | null }[];
    roster: { name: string; attending: boolean; events: Record<string, string> }[];
    answers: { question: string; answer: string }[];
    seats: { plan: string; table: string; person: string }[];
    tasks: unknown[]; requests: unknown[];
    scope: "full" | "scrubbed"; phone?: string | null; email?: string | null; hasPhone?: boolean; hasEmail?: boolean;
  };
  waiting_for_you: { conversation_id: string; text: string; at: string } | null;
};
export type RequestRow = {
  id: string; kind: string; status: "open" | "approved" | "declined" | "cancelled"; guest_ids: string[]; payload: Record<string, unknown>;
  note: string; created_by_email: string; created_by_role: string; lang: "en" | "es"; resolution: Record<string, unknown>;
  resolved_at: string | null; created_at: string; updated_at: string; guest_names?: string[]; thread?: { id: string; author_role: string; author_email: string; body: string; created_at: string }[];
};
export type TaskRow = { id: string; title: string; detail: string; status: "open" | "in_progress" | "done"; assigned_to: "planner" | "couple"; guest_ids: string[]; created_at: string; updated_at: string };

export const useCoupleHome = () => useQuery({ queryKey: ["couple-home"], queryFn: () => get<CoupleHome>("/couple/home") });
export const useCoupleGuests = (q: string, filter: string) =>
  useQuery({ queryKey: ["couple-guests", q, filter], queryFn: () => get<{ items: GuestListItem[]; next_cursor: number | null; totals: Totals }>(`/couple/guests?q=${encodeURIComponent(q)}&filter=${filter}`), placeholderData: (prev) => prev });
export const useGuestDetail = (id: string) => useQuery({ queryKey: ["couple-guest", id], queryFn: () => get<GuestDetail>(`/couple/guests/${id}`), enabled: !!id });
export const useCoupleRsvps = (filter: string) => useQuery({ queryKey: ["couple-rsvps", filter], queryFn: () => get<{ items: RsvpListItem[]; totals: Totals; deadline: string | null }>(`/couple/rsvps?filter=${filter}`), placeholderData: (prev) => prev });
export const useInbox = (filter: string) => useQuery({ queryKey: ["couple-inbox", filter], queryFn: () => get<{ items: InboxItem[]; needs_you: number }>(`/couple/messages?filter=${filter}`), refetchInterval: 30_000, placeholderData: (prev) => prev });
export const useCoupleDayOf = () => useQuery({ queryKey: ["couple-dayof"], queryFn: () => get<CoupleDayOf>("/couple/dayof"), refetchInterval: 30_000 });
export const useMore = () => useQuery({ queryKey: ["couple-more"], queryFn: () => get<{ entries: Record<string, MoreEntry>; site_slug: string; tier: string }>("/couple/more") });
export const useCoupleRequests = () => useQuery({ queryKey: ["couple-requests"], queryFn: () => get<{ pending: boolean; requests: RequestRow[] }>("/couple/requests") });

// ---- planner
export type PlannerHome = {
  greeting_name: string;
  weddings: { slug: string; couple_names: string; wedding_date: string | null; days_to_go: number | null; open_requests: number; status: string; current: boolean }[];
  briefing: { text: string; href: string; tone: "risk" | "warn" | "info" }[];
  totals: { attending_seats: number; pending_parties: number; parties: number };
  open_tasks: number;
};
export type PlannerGuest = { id: string; name: string; initials: string; party_size: number; members: string[]; tags: string[]; status: "attending" | "declined" | "pending"; hasPhone: boolean; hasEmail: boolean; language: string | null; notes: string | null; checked_in_at: string | null };

export const usePlannerHome = () => useQuery({ queryKey: ["planner-home"], queryFn: () => get<PlannerHome>("/planner/home") });
export const usePlannerGuests = (slug: string) => useQuery({ queryKey: ["planner-guests", slug], queryFn: () => get<{ guests: PlannerGuest[]; count: number }>(`/planner/weddings/${slug}/guests`), enabled: !!slug });
export const usePlannerRequests = () => useQuery({ queryKey: ["planner-requests"], queryFn: () => get<{ pending: boolean; requests: RequestRow[]; tasks: TaskRow[]; tasks_pending: boolean }>("/planner/requests") });
export const usePlannerTasks = () => useQuery({ queryKey: ["planner-tasks"], queryFn: () => get<{ pending: boolean; tasks: TaskRow[] }>("/planner/tasks") });

/** Mutation that invalidates the given keys on success. */
export function useApiMutation<TIn, TOut>(path: string | ((input: TIn) => string), invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TIn) => post<TOut>(typeof path === "function" ? path(input) : path, input),
    onSuccess: () => {
      for (const k of invalidate) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
