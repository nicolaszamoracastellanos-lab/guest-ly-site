// #26 arrival and departure windows, the app's half (1.4.0,
// MW_TRAVEL_WINDOWS). Pure, no imports (scripts/tests/travel.test.ts).
//  - guest: GET/POST /guest/travel {enabled, required, wedding_date,
//    points[{id,label}], travel{arrival,departure:{date,time,point,ref}}};
//    404 = the couple does not ask (or the flag is off): the Home row hides.
//  - couple GET /couple/arrivals, planner GET /planner/weddings/{slug}/arrivals:
//    {arrivals, departures, collecting}, boards by day, window and place.
// Times are wall-clock strings ("14:20") in the place's own local time: shown
// as typed, never converted to a zone. Dates are YYYY-MM-DD, noon-anchored.

export type TravelLeg = { date: string | null; time: string | null; point: string | null; ref: string | null };
export type GuestTravel = {
  enabled: boolean;
  required: boolean;
  wedding_date: string | null;
  points: { id: string; label: string }[];
  travel: { arrival: TravelLeg; departure: TravelLeg };
};

export const EMPTY_LEG: TravelLeg = { date: null, time: null, point: null, ref: null };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function readLeg(v: unknown): TravelLeg {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return { date: str(o.date), time: str(o.time), point: str(o.point), ref: str(o.ref) };
}

export function readGuestTravel(v: unknown): GuestTravel | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const t = o.travel && typeof o.travel === "object" ? (o.travel as Record<string, unknown>) : {};
  return {
    enabled: o.enabled !== false,
    required: o.required === true,
    wedding_date: str(o.wedding_date),
    points: Array.isArray(o.points) ? (o.points as Record<string, unknown>[]).map((p) => ({ id: str(p?.id) ?? "", label: str(p?.label) ?? "" })).filter((p) => p.id && p.label) : [],
    travel: { arrival: readLeg(t.arrival), departure: readLeg(t.departure) },
  };
}

export function legEmpty(l: TravelLeg): boolean {
  return !l.date && !l.time && !l.point && !l.ref;
}

/** The point as people read it: a pickup point's label, or what the guest typed. */
export function pointLabel(point: string | null, points: { id: string; label: string }[]): string | null {
  if (!point) return null;
  return points.find((p) => p.id === point)?.label ?? point;
}

/** Is the point one of the couple's pickup points (else it was typed). */
export function isKnownPoint(point: string | null, points: { id: string; label: string }[]): boolean {
  return !!point && points.some((p) => p.id === point);
}

/** The body of POST /guest/travel: nulls for empty, the flight number in the
 *  server's alphabet (letters, digits, space . - /, 12 characters). */
export function travelBody(arrival: TravelLeg, departure: TravelLeg): { travel: { arrival: TravelLeg; departure: TravelLeg } } {
  const clean = (l: TravelLeg): TravelLeg => ({
    date: l.date || null,
    time: l.time || null,
    point: (l.point ?? "").trim().slice(0, 120) || null,
    ref: (l.ref ?? "").replace(/[^A-Za-z0-9 ./-]/g, "").trim().slice(0, 12) || null,
  });
  return { travel: { arrival: clean(arrival), departure: clean(departure) } };
}

/** What the guest can fix before sending (the server checks it all again). */
export function legProblem(l: TravelLeg): "time_needs_date" | null {
  return l.time && !l.date ? "time_needs_date" : null;
}

// ------------------------------------------------------------------ boards

export type BoardRow = { guest_id: string; name: string; people: number; time: string | null; point: string | null; ref: string | null; needs_transfer: boolean; changed_by_guest: boolean; updated_at: string | null };
export type BoardPoint = { label: string | null; parties: number; people: number; rows: BoardRow[] };
export type BoardWindow = { start: string | null; end: string | null; parties: number; people: number; needs_transfer: number; points: BoardPoint[] };
export type BoardDay = { date: string; parties: number; people: number; windows: BoardWindow[] };
export type Board = { direction: "arrival" | "departure"; window_minutes: number; totals: { parties: number; people: number }; missing: number; days: BoardDay[]; undated: BoardRow[] };
export type Arrivals = { arrivals: Board; departures: Board; collecting: boolean };

export function boardEmpty(b: Board | null | undefined): boolean {
  return !b || (b.days.length === 0 && b.undated.length === 0);
}
