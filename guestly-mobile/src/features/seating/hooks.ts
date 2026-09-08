// Seating data: the server surface plus a local draft store so the tables
// screen and the table detail edit the same plan and save it explicitly.

import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

export type SeatingCriterion = "party" | "tags" | "surname" | "relationship";
export type SeatAssignment = {
  rsvp_id: string;
  person: string;
  kind: "main" | "companion";
};
export type SeatingTable = {
  id: string;
  label: string;
  x: number;
  y: number;
  shape: "round" | "rect";
  capacity: number;
  confidence?: number;
  source: "ai" | "manual";
  seated: number;
  free: number;
  over_capacity: boolean;
  people: (SeatAssignment & { party_name: string; confirmed: boolean })[];
};
export type SeatingParty = {
  rsvp_id: string;
  name: string;
  size: number;
  people: { name: string; kind: "main" | "companion" }[];
  tags: string[];
  confirmed: boolean;
  guest_id: string | null;
  table_ids: string[];
  unseated: number;
};
export type SeatingSurface = {
  plan_id: string;
  name: string;
  updated_at: string;
  has_floor_plan: boolean;
  analysis_notes: string | null;
  criteria_order: SeatingCriterion[];
  estimated_guests: number | null;
  notes: string;
  tables: SeatingTable[];
  parties: SeatingParty[];
  stats: {
    confirmed_seats: number;
    seated: number;
    unseated_parties: number;
    unseated_people: number;
    tables: number;
    capacity: number;
    free_seats: number;
  };
};
export type AutoAssignResult = {
  assignments: Record<string, SeatAssignment[]>;
  placed: { rsvp_id: string; name: string; size: number; table_id: string }[];
  unplaced: { rsvp_id: string; name: string; size: number }[];
  warnings: { en: string; es: string }[];
  tables_used: number;
  applied: boolean;
  surface?: SeatingSurface;
};

export const SEATING_KEY = ["couple-seating"];
export const PLANNER_SEATING_KEY = ["planner-seating"];

export const useCoupleSeating = () =>
  useQuery({
    queryKey: SEATING_KEY,
    queryFn: () => get<SeatingSurface>("/couple/seating"),
  });
export const usePlannerSeating = () =>
  useQuery({
    queryKey: PLANNER_SEATING_KEY,
    queryFn: () => get<SeatingSurface>("/planner/seating"),
  });

/* ------------------------------- draft store ------------------------------ */

type Draft = {
  basedOn: string | null;
  tables: {
    id: string;
    label: string;
    capacity: number;
    shape: "round" | "rect";
    source: "ai" | "manual";
    confidence?: number;
  }[];
  assignments: Record<string, SeatAssignment[]>;
  dirty: boolean;
};

let draft: Draft = { basedOn: null, tables: [], assignments: {}, dirty: false };
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function set(next: Draft) {
  draft = next;
  emit();
}

/** Seeds the draft from a fresh surface unless there are unsaved edits. */
export function seedDraft(surface: SeatingSurface, force = false) {
  if (!force && draft.dirty && draft.basedOn === surface.plan_id) return;
  set({
    basedOn: surface.plan_id,
    tables: surface.tables.map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      shape: t.shape,
      source: t.source,
      confidence: t.confidence,
    })),
    assignments: Object.fromEntries(
      surface.tables.map((t) => [
        t.id,
        t.people.map((p) => ({
          rsvp_id: p.rsvp_id,
          person: p.person,
          kind: p.kind,
        })),
      ]),
    ),
    dirty: false,
  });
}

export function useDraft(): Draft {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => draft,
    () => draft,
  );
}

function newId(): string {
  return `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const draftActions = {
  addTable(label: string, capacity: number, shape: "round" | "rect") {
    const id = newId();
    set({
      ...draft,
      tables: [
        ...draft.tables,
        { id, label, capacity, shape, source: "manual" },
      ],
      assignments: { ...draft.assignments, [id]: [] },
      dirty: true,
    });
    return id;
  },
  updateTable(
    id: string,
    patch: Partial<{
      label: string;
      capacity: number;
      shape: "round" | "rect";
      source: "ai" | "manual";
      confidence: number | undefined;
    }>,
  ) {
    set({
      ...draft,
      tables: draft.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      dirty: true,
    });
  },
  removeTable(id: string) {
    const assignments = { ...draft.assignments };
    delete assignments[id];
    set({
      ...draft,
      tables: draft.tables.filter((t) => t.id !== id),
      assignments,
      dirty: true,
    });
  },
  /** Seats every unseated person of the party at the table. */
  seatParty(party: SeatingParty, tableId: string) {
    const seatedNames = new Set<string>();
    for (const list of Object.values(draft.assignments))
      for (const a of list)
        if (a.rsvp_id === party.rsvp_id) seatedNames.add(a.person);
    const toSeat = party.people.filter((p) => !seatedNames.has(p.name));
    // Companions can share a placeholder name; count instead of matching.
    const seatedCount = [...Object.values(draft.assignments)]
      .flat()
      .filter((a) => a.rsvp_id === party.rsvp_id).length;
    const remaining = Math.max(0, party.size - seatedCount);
    const entries = (toSeat.length ? toSeat : party.people)
      .slice(0, remaining)
      .map((p) => ({ rsvp_id: party.rsvp_id, person: p.name, kind: p.kind }));
    if (!entries.length) return;
    set({
      ...draft,
      assignments: {
        ...draft.assignments,
        [tableId]: [...(draft.assignments[tableId] ?? []), ...entries],
      },
      dirty: true,
    });
  },
  unseatPerson(tableId: string, index: number) {
    const list = [...(draft.assignments[tableId] ?? [])];
    list.splice(index, 1);
    set({
      ...draft,
      assignments: { ...draft.assignments, [tableId]: list },
      dirty: true,
    });
  },
  unseatParty(rsvpId: string, tableId?: string) {
    const assignments: Record<string, SeatAssignment[]> = {};
    for (const [tid, list] of Object.entries(draft.assignments)) {
      assignments[tid] =
        tableId && tid !== tableId
          ? list
          : list.filter((a) => a.rsvp_id !== rsvpId);
    }
    set({ ...draft, assignments, dirty: true });
  },
  replaceAssignments(assignments: Record<string, SeatAssignment[]>) {
    set({ ...draft, assignments, dirty: true });
  },
  markSaved() {
    set({ ...draft, dirty: false });
  },
};

/** Derived view of the draft against the server roster. */
export function deriveDraft(surface: SeatingSurface, d: Draft) {
  const partyByRsvp = new Map(surface.parties.map((p) => [p.rsvp_id, p]));
  const seatedCount = new Map<string, number>();
  const tablesByParty = new Map<string, Set<string>>();
  const tables = d.tables.map((t) => {
    const people = (d.assignments[t.id] ?? []).map((a) => {
      seatedCount.set(a.rsvp_id, (seatedCount.get(a.rsvp_id) ?? 0) + 1);
      const s = tablesByParty.get(a.rsvp_id) ?? new Set<string>();
      s.add(t.id);
      tablesByParty.set(a.rsvp_id, s);
      const party = partyByRsvp.get(a.rsvp_id);
      return {
        ...a,
        party_name: party?.name ?? a.person,
        confirmed: party?.confirmed ?? false,
      };
    });
    return {
      ...t,
      people,
      seated: people.length,
      free: Math.max(0, t.capacity - people.length),
      over_capacity: people.length > t.capacity,
    };
  });
  const parties = surface.parties.map((p) => ({
    ...p,
    table_ids: [...(tablesByParty.get(p.rsvp_id) ?? [])],
    unseated: Math.max(0, p.size - (seatedCount.get(p.rsvp_id) ?? 0)),
  }));
  const capacity = tables.reduce((n, t) => n + t.capacity, 0);
  const seated = tables.reduce((n, t) => n + t.seated, 0);
  const unseatedConfirmed = parties.filter(
    (p) => p.confirmed && p.unseated > 0,
  );
  return {
    tables,
    parties,
    stats: {
      seated,
      unseated_parties: unseatedConfirmed.length,
      unseated_people: unseatedConfirmed.reduce((n, p) => n + p.unseated, 0),
      capacity,
      free_seats: Math.max(0, capacity - seated),
      tables: tables.length,
    },
  };
}

export function useSavePlan() {
  const qc = useQueryClient();
  return async () => {
    const body = {
      tables: draft.tables.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
      })),
      assignments: draft.assignments,
    };
    const surface = await post<SeatingSurface>("/couple/seating", body);
    qc.setQueryData(SEATING_KEY, surface);
    seedDraft(surface, true);
    return surface;
  };
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
