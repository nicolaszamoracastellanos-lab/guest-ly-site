// #55 table shapes, the app's read side (Master Wave, 1.4.0). The portal sends
// the real shape of every table (square, oval, half moon, serpentine,
// imperial, cocktail, U, plus round and rect) with `shape_fallback` (round or
// rect) on the seating surface to builds from SHAPES_APP_VERSION, and always in
// the day pack (seating.tables). The geometry is the portal's own
// src/lib/table-shapes.ts, copied verbatim as ./tableShapes.ts (drift check:
// scripts/check-verbatim-copies.mjs). This file turns a payload table into
// something to draw: the shape to draw (a shape this build does not know draws
// its shape_fallback), its options, its outline and chairs in points, where it
// stands on a plan, and the words VoiceOver reads.
//
// Pure: no React, no network. scripts/tests/table-shapes.test.ts runs it.

import {
  cleanShapeOptions,
  isTableShape,
  labelAnchor,
  labelOnPlate,
  pathOf,
  rotatePts,
  shapeDims,
  shapeOutline,
  shapeSeats,
  type Pt,
  type ShapeOptions,
  type TableShape,
} from "./tableShapes";

export type Lang = "en" | "es";

/** The shape fields a payload table may carry (all optional: a 1.3-era answer has only round or rect). */
export type ShapeFields = {
  shape?: unknown;
  shape_fallback?: unknown;
  rotation?: unknown;
  ends?: unknown;
  one_side?: unknown;
  segments?: unknown;
};

/** A table as this build draws it. */
export type DrawnShape = {
  /** The shape drawn: the table's own, or its fallback when this build does not know it. */
  shape: TableShape;
  /** The word the server sent (kept so a save sends it back unchanged). */
  sent: string;
  /** False when the server's shape is unknown here and the fallback is drawn. */
  known: boolean;
  options: ShapeOptions;
};

/**
 * The shape to draw for a payload table. Known shapes draw as themselves with
 * their options; an unknown word (a later server's new shape) draws
 * shape_fallback (round or rect) with no options; with no usable fallback, a
 * table reads as round, as the portal reads an unknown word.
 */
export function readShape(t: ShapeFields): DrawnShape {
  const sent = typeof t.shape === "string" && t.shape ? t.shape : "round";
  if (isTableShape(sent)) {
    return { shape: sent, sent, known: true, options: cleanShapeOptions(sent, t as Record<string, unknown>) };
  }
  const fb = t.shape_fallback === "rect" || t.shape_fallback === "round" ? t.shape_fallback : "round";
  return { shape: fb, sent, known: false, options: {} };
}

/** The portal's shape names (src/lib/i18n/seating-shapes.ts, word for word; table-shapes.test checks them). */
export const SHAPE_NAMES: Record<Lang, Record<TableShape, string>> = {
  es: {
    round: "Redonda",
    square: "Cuadrada",
    rect: "Rectangular",
    oval: "Ovalada",
    half_moon: "Media luna",
    serpentine: "Serpentina",
    imperial: "Imperial",
    cocktail: "Cóctel",
    u_shape: "En U",
  },
  en: {
    round: "Round",
    square: "Square",
    rect: "Rectangular",
    oval: "Oval",
    half_moon: "Half moon",
    serpentine: "Serpentine",
    imperial: "Imperial",
    cocktail: "Cocktail",
    u_shape: "U shape",
  },
};

/**
 * What VoiceOver reads for one table: its name, the shape and the seats, then
 * how many sit there when known. "Mesa 4, Imperial, 20 lugares, 12 ocupados".
 */
export function tableA11y(lang: Lang, t: { label: string; shape: TableShape; capacity: number; seated?: number | null; over?: boolean }): string {
  const name = SHAPE_NAMES[lang][t.shape];
  const seats = lang === "es" ? (t.capacity === 1 ? "1 lugar" : `${t.capacity} lugares`) : t.capacity === 1 ? "1 seat" : `${t.capacity} seats`;
  const parts = [t.label.trim() || name, name, seats];
  if (typeof t.seated === "number") parts.push(lang === "es" ? (t.seated === 1 ? "1 ocupado" : `${t.seated} ocupados`) : `${t.seated} seated`);
  if (t.over) parts.push(lang === "es" ? "más personas que lugares" : "more people than seats");
  return parts.join(", ");
}

/** What fits inside a table on the plan: its number, else its initials (the web plan's tableNumber). */
export function tableMark(label: string): string {
  const m = label.match(/\d+/);
  if (m) return m[0];
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return label.trim().slice(0, 3) || "?";
}

/* -------------------------------- drawing -------------------------------- */

/** One table drawn in points, centred in its own box of w x h. */
export type TableArt = {
  w: number;
  h: number;
  /** SVG path of the table top, in the box's coordinates. */
  body: string;
  /** Chair centres, in the box's coordinates. */
  seats: Pt[];
  /** Where the table's mark sits (its centre), in the box's coordinates. */
  label: Pt;
  /** Points per metre this table was drawn at. */
  k: number;
  /** The mark sits on a small plate: a U's bar or a serpentine's band (the portal's labelOnPlate). */
  plate: boolean;
};

export type ArtOptions = {
  /** Points per metre before the size limits below. */
  ppm: number;
  /** Chairs stand this far outside the table's edge, in points. */
  gap: number;
  /** Chair radius, in points (the box leaves room for it). */
  dot: number;
  /** The table top is never smaller than this many points across (its mark must fit). */
  minBody: number;
  /** The table top's long side never passes this many points (a long table does not cover the plan). */
  maxLen: number;
  /** A long, oval or serpentine top is never thinner than this many points, so its mark fits (the web plan does the same). */
  minDepth?: number;
};

/**
 * One table in points: the shared metre geometry times a scale, so a 20-seat
 * imperial comes out longer than a 12-seat one, turned by its rotation, with
 * one chair per seat. The scale drops for a table longer than maxLen and rises
 * for one smaller than minBody; chairs keep their gap in points either way.
 */
export function tableArt(t: { capacity: number } & DrawnShape, o: ArtOptions): TableArt {
  const capacity = Math.max(1, Math.min(50, Math.round(t.capacity) || 1));
  let dims = shapeDims({ shape: t.shape, capacity, ...t.options });
  const big = Math.max(dims.len, dims.depth);
  let k = o.ppm;
  if (big * k < o.minBody) k = o.minBody / big;
  if (dims.len * k > o.maxLen) k = Math.max(o.maxLen / dims.len, o.minBody / Math.max(dims.len, 0.01));
  const thin = (o.minDepth ?? 0) / k;
  if (thin > 0 && (t.shape === "rect" || t.shape === "imperial" || t.shape === "oval" || t.shape === "serpentine")) {
    if (t.shape === "serpentine") dims = { ...dims, depth: Math.max(dims.depth, thin), band: Math.max(dims.band, thin) };
    else if (dims.depth < thin) dims = { ...dims, depth: Math.min(thin, dims.len) };
  }
  const rot = t.options.rotation ?? 0;
  const gapM = o.gap / k;
  const bodyPts = rotatePts(shapeOutline(t.shape, dims, t.options), rot).map((p) => ({ x: p.x * k, y: p.y * k }));
  const seatPts = rotatePts(shapeSeats(t.shape, capacity, dims, gapM, t.options), rot).map((p) => ({ x: p.x * k, y: p.y * k }));
  const lab = rotatePts([labelAnchor(t.shape, dims, 0)], rot)[0];
  let mx = 0;
  let my = 0;
  for (const p of bodyPts) {
    mx = Math.max(mx, Math.abs(p.x));
    my = Math.max(my, Math.abs(p.y));
  }
  for (const p of seatPts) {
    mx = Math.max(mx, Math.abs(p.x) + o.dot);
    my = Math.max(my, Math.abs(p.y) + o.dot);
  }
  const w = Math.ceil((mx + 1) * 2);
  const h = Math.ceil((my + 1) * 2);
  const cx = w / 2;
  const cy = h / 2;
  return {
    w,
    h,
    body: pathOf(bodyPts, cx, cy),
    seats: seatPts.map((p) => ({ x: round2(p.x + cx), y: round2(p.y + cy) })),
    label: { x: round2(lab.x * k + cx), y: round2(lab.y * k + cy) },
    k,
    plate: labelOnPlate(t.shape),
  };
}

/** One table fitted inside a box of boxW x boxH points (a list row's mark, the table screen's figure). */
export function fitArt(t: { capacity: number } & DrawnShape, boxW: number, boxH: number, o: { gap: number; dot: number }): TableArt {
  // Draw once at a probe scale, then solve for the scale where the body plus
  // the chairs (whose gap and size stay in points) fit the box; a few more
  // passes shrink it if rounding or chair spacing still spills over.
  const base = { gap: o.gap, dot: o.dot, minBody: 1, maxLen: Infinity };
  const probe = tableArt(t, { ...base, ppm: 40 });
  const fixed = o.gap + o.dot;
  const sx = (boxW / 2 - 1 - fixed) / Math.max(0.01, probe.w / 2 - 1 - fixed);
  const sy = (boxH / 2 - 1 - fixed) / Math.max(0.01, probe.h / 2 - 1 - fixed);
  let art = tableArt(t, { ...base, ppm: Math.max(1, probe.k * Math.min(sx, sy)) });
  for (let i = 0; i < 4 && (art.w > boxW || art.h > boxH); i++) {
    art = tableArt(t, { ...base, ppm: Math.max(0.5, art.k * Math.min(boxW / art.w, boxH / art.h) * 0.94) });
  }
  return art;
}

/* --------------------------------- plan ---------------------------------- */

/** The metres the plan is drawn as if it were across (the web plan's ROOM_REF_M without a scale). */
export const ROOM_REF_M = 27;

export type PlanTableIn = { id: string; label: string; capacity: number; seated?: number | null; x?: number | null; y?: number | null } & ShapeFields;
export type PlanTable = {
  id: string;
  label: string;
  mark: string;
  capacity: number;
  seated: number | null;
  drawn: DrawnShape;
  art: TableArt;
  /** Top-left of the table's box on the plan, in points. */
  left: number;
  top: number;
};

/**
 * Every table placed on a plan of width w and height h (points): the centre at
 * its x and y (fractions of the plan; a table without a place takes the next
 * spot of the server's grid for tables made on a phone), kept whole inside
 * the plan, drawn at one scale for the whole plan so long tables are longer.
 */
export function planLayout(tables: readonly PlanTableIn[], w: number, h: number, o: { gap?: number; dot?: number; minBody?: number; minDepth?: number } = {}): PlanTable[] {
  const gap = o.gap ?? 5;
  const dot = o.dot ?? 2.6;
  const minBody = o.minBody ?? 26;
  const minDepth = o.minDepth ?? 22;
  const ppm = w / ROOM_REF_M;
  let grid = tables.filter((t) => isFrac(t.x) && isFrac(t.y)).length;
  return tables.map((t) => {
    const drawn = readShape(t);
    const art = tableArt({ capacity: t.capacity, ...drawn }, { ppm, gap, dot, minBody, maxLen: w * 0.3, minDepth });
    let fx = t.x;
    let fy = t.y;
    if (!isFrac(fx) || !isFrac(fy)) {
      const col = grid % 4;
      const row = Math.floor(grid / 4);
      grid += 1;
      fx = Math.min(0.95, 0.15 + col * 0.23);
      fy = Math.min(0.95, 0.15 + row * 0.2);
    }
    const cx = clamp((fx as number) * w, art.w / 2, w - art.w / 2);
    const cy = clamp((fy as number) * h, art.h / 2, h - art.h / 2);
    return {
      id: t.id,
      label: t.label,
      mark: tableMark(t.label),
      capacity: t.capacity,
      seated: typeof t.seated === "number" ? t.seated : null,
      drawn,
      art,
      left: round2(cx - art.w / 2),
      top: round2(cy - art.h / 2),
    };
  });
}

function isFrac(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}
function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
