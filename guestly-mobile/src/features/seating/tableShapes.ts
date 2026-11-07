// Banquet table shapes (Master Wave, Nicolas's s-note, Nov 6): the shapes a
// venue really uses, their default seats, where the chairs go, and how a
// plan reading or a typed phrase names them. Pure: no React, no server code,
// no imports with side effects, so the canvas, the PDF, the routes, the
// mobile API, the analysis parser and the tests all share one geometry.
//
// THE CONTRACT
//   * A table's `shape` is one of TABLE_SHAPES. "round" and "rect" are the
//     two shapes older code wrote; they keep their meaning (rect is the long
//     banquet table), so every stored plan reads exactly as before.
//   * Readers that only know round and rect (app 1.2 and 1.3, any older
//     consumer) get legacyShape(shape): long, imperial, serpentine and U read
//     as rect; oval, half moon and cocktail read as round.
//   * Geometry is unit free: give it a length and a depth in metres and the
//     seats come back in metres; give it pixels and they come back in pixels.
//     The body is centred on (0, 0), long axis along x, y down, unrotated;
//     rotate() turns the result.

export const TABLE_SHAPES = [
  "round",
  "square",
  "rect",
  "oval",
  "half_moon",
  "serpentine",
  "imperial",
  "cocktail",
  "u_shape",
] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];
export type LegacyShape = "round" | "rect";

/** The order the pickers show them (Spanish first for planners: Redonda, Cuadrada, Rectangular...). */
export const SHAPE_ORDER: readonly TableShape[] = TABLE_SHAPES;

/** The shapes only a wedding with MW_TABLE_SHAPES on can pick. */
export const NEW_SHAPES: readonly TableShape[] = TABLE_SHAPES.filter((s) => s !== "round" && s !== "rect");

export const DEFAULT_SHAPE_CAPACITY: Record<TableShape, number> = {
  round: 10,
  square: 8,
  rect: 8,
  oval: 12,
  half_moon: 5,
  serpentine: 16,
  imperial: 20,
  cocktail: 4,
  u_shape: 24,
};

const LEGACY: Record<TableShape, LegacyShape> = {
  round: "round",
  square: "rect",
  rect: "rect",
  oval: "round",
  half_moon: "round",
  serpentine: "rect",
  imperial: "rect",
  cocktail: "round",
  u_shape: "rect",
};

/** What a reader that knows only round and rect should draw. */
export function legacyShape(shape: string | null | undefined): LegacyShape {
  return isTableShape(shape) ? LEGACY[shape] : shape === "rect" ? "rect" : "round";
}

export function isTableShape(v: unknown): v is TableShape {
  return typeof v === "string" && (TABLE_SHAPES as readonly string[]).includes(v);
}

/** Shapes whose drawing changes when turned (a round or a cocktail table does not). */
export function isRotatable(shape: TableShape): boolean {
  return shape !== "round" && shape !== "cocktail";
}

/** Long tables where seats at the two ends are a choice. */
export function hasEndsOption(shape: TableShape): boolean {
  return shape === "rect";
}

/** The optional drawing fields a table may carry (all absent on tables older code wrote). */
export type ShapeOptions = {
  /** Degrees clockwise, 0 to 359. */
  rotation?: number;
  /** rect: one seat at each end too. */
  ends?: boolean;
  /** rect: seats on one side only (a head table facing the room). */
  one_side?: boolean;
  /** serpentine: curved sections, 2 to 6. */
  segments?: number;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Degrees folded to the turn that draws the same table (0..359, 0..179 or 0..89). */
export function normalizeRotation(shape: TableShape, deg: unknown): number {
  if (!finite(deg) || !isRotatable(shape)) return 0;
  const period = shape === "square" ? 90 : shape === "half_moon" || shape === "u_shape" ? 360 : 180;
  const r = Math.round(((deg % period) + period) % period);
  return r === period ? 0 : r;
}

/**
 * The optional fields as stored: only what means something for this shape,
 * only when it differs from the default, so an untouched table keeps exactly
 * the keys older code wrote.
 */
export function cleanShapeOptions(shape: TableShape, raw: Record<string, unknown> | ShapeOptions | null | undefined): ShapeOptions {
  const out: ShapeOptions = {};
  if (!raw) return out;
  const r = raw as Record<string, unknown>;
  const rot = normalizeRotation(shape, r.rotation);
  if (rot) out.rotation = rot;
  if (shape === "rect") {
    if (r.ends === true) out.ends = true;
    if (r.one_side === true) out.one_side = true;
  }
  if (shape === "serpentine" && finite(r.segments)) {
    const s = Math.round(r.segments);
    if (s >= 2 && s <= 6) out.segments = s;
  }
  return out;
}

/* --------------------------------- words --------------------------------- */

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Words a person or a model uses for each shape, English and Spanish (folded:
 * no accents, lower case). Order matters: the first shape whose words match
 * wins, so the specific shapes come before "rect" and "round".
 */
const SHAPE_WORDS: [TableShape, RegExp][] = [
  ["imperial", /\bimperial(es)?\b/],
  ["serpentine", /\bserpenti(ne|na|nas|nes)\b|\bserpiente\b|\bs (shaped|shape|curve)\b|\bcurva en s\b|\bforma de s\b|\bondulad[ao]s?\b|\bwave table\b/],
  ["half_moon", /\bhalf moons?\b|\bhalfmoon\b|\bmedias? lunas?\b|\bmedialuna\b|\bcrescent\b|\bsemi ?circular\b|\bsemicirculo\b/],
  ["u_shape", /\bu shaped?\b|\bshape u\b|\ben (forma de )?u\b|\bforma de u\b|\bherradura\b|\bhorseshoe\b/],
  ["cocktail", /\bcocktail\b|\bcoctel(era)?s?\b|\bhigh ?tops?\b|\bhighboys?\b|\bperiqueras?\b|\bbistro\b|\bstanding\b|\bmesas? altas?\b|\bde pie\b/],
  ["oval", /\bovals?\b|\bovalad[ao]s?\b|\belipti(ca|cas|c|cal)\b|\belliptical\b/],
  ["square", /\bsquares?\b|\bcuadrad[ao]s?\b/],
  ["rect", /\brect(angle|angular|angulares)?\b|\brectangulo\b|\bbanquet(e|es)?\b|\blong\b|\blarg[ao]s?\b|\btablon(es)?\b|\bfamily style\b|\bking\b/],
  ["round", /\bround\b|\bredond[ao]s?\b|\bcircular(es)?\b|\bcircle\b|\bcirculo\b/],
];

/** A head table (seats facing the room on one side): a rect with one_side, unless a shape word says otherwise. */
const HEAD_TABLE = /\bhead tables?\b|\bsweetheart\b|\bmesa (principal|presidencial|de honor|de los novios|nupcial)\b|\bpresidium\b/;

/** One shape word (a model's enum, a synonym, a label) to a shape, or null. */
export function shapeFromWord(raw: unknown): TableShape | null {
  if (typeof raw !== "string") return null;
  if (isTableShape(raw)) return raw;
  const f = fold(raw);
  if (!f) return null;
  if (f === "rectangular" || f === "rectangle" || f === "banquet" || f === "long") return "rect";
  for (const [shape, re] of SHAPE_WORDS) if (re.test(f)) return shape;
  return null;
}

const SEAT_WORDS =
  "pax|personas?|persons?|people|guests?|invitados?|sillas?|chairs?|lugares?|seats?|puestos?|asientos?|comensales|cubiertos|covers|plazas?";

/**
 * A typed or printed phrase ("mesa imperial de 20", "Serpentine 16 pax",
 * "Mesa principal", "2 medias lunas") read as a shape and a seat count. Table
 * numbers are never read as seats ("Mesa 4" has no seat count).
 */
export function parseTableText(text: unknown): { shape: TableShape | null; capacity: number | null; one_side?: true } {
  if (typeof text !== "string") return { shape: null, capacity: null };
  const f = fold(text);
  if (!f) return { shape: null, capacity: null };
  let shape: TableShape | null = null;
  for (const [s, re] of SHAPE_WORDS) {
    if (re.test(f)) {
      shape = s;
      break;
    }
  }
  let one_side: true | undefined;
  if (!shape && HEAD_TABLE.test(f)) {
    shape = "rect";
    one_side = true;
  }
  let capacity: number | null = null;
  const patterns = [
    new RegExp(`\\b(\\d{1,2})\\s*(?:${SEAT_WORDS})\\b`),
    // "de 20", "para 10", "x 12"; never a size ("de 8 x 10 m", "de 3 m").
    /\b(?:de|para|for|of|con|with|x)\s*(\d{1,2})\b(?!\s*(?:x\s*\d|m\b|mts\b|metros\b|ft\b|cm\b|[.,]\d))/,
    /\b(\d{1,2})\s*p\b/,
    /\b(\d{1,2})\s*(?:seater|plazas)\b/,
  ];
  for (const re of patterns) {
    const m = f.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 50) {
        capacity = n;
        break;
      }
    }
  }
  return one_side ? { shape, capacity, one_side } : { shape, capacity };
}

/* -------------------------------- geometry ------------------------------- */

export type Pt = { x: number; y: number };

/** Real sizes the shapes start from (same names as venue-scale's TableSizes). */
export type ShapeSizes = { round_m: number; rect_w_m: number; rect_h_m: number };
export const DEFAULT_SHAPE_SIZES: ShapeSizes = { round_m: 1.52, rect_w_m: 2.44, rect_h_m: 0.76 };

/** Chairs stand this far outside the table's edge (metres, for the to-scale drawing and the PDF). */
export const CHAIR_GAP_M = 0.35;

/**
 * A table's body in metres: `len` along its long axis, `depth` across it and,
 * for serpentine and U, `band` (the width of the table top itself). Seats
 * scale with length: a 20-seat imperial is longer than a 12-seat one.
 */
export type ShapeDims = { len: number; depth: number; band: number };

export function shapeDims(
  t: { shape: TableShape; capacity: number } & ShapeOptions,
  sizes: ShapeSizes = DEFAULT_SHAPE_SIZES
): ShapeDims {
  const n = Math.max(1, Math.round(t.capacity));
  const pitch = sizes.rect_w_m / 4; // 0.61 m a seat: an 8-seat banquet is exactly rect_w_m
  const band = sizes.rect_h_m;
  switch (t.shape) {
    case "round":
      return { len: sizes.round_m, depth: sizes.round_m, band };
    case "cocktail": {
      const d = Math.max(0.6, sizes.round_m / 2);
      return { len: d, depth: d, band };
    }
    case "square": {
      const side = Math.max(0.9, Math.ceil(n / 4) * 0.75);
      return { len: side, depth: side, band };
    }
    case "oval": {
      const len = Math.max(1.8, n * 0.2);
      return { len, depth: len / 2, band };
    }
    case "half_moon":
      return { len: sizes.round_m, depth: sizes.round_m / 2, band };
    case "imperial":
      return { len: Math.max(2.4, Math.ceil(n / 2) * pitch), depth: Math.max(band, 1.1), band };
    case "serpentine":
      return { len: Math.max(2.4, Math.ceil(n / 2) * pitch), depth: band, band };
    case "u_shape":
      return { len: Math.max(2.4, n * pitch * 0.4), depth: Math.max(1.8, n * pitch * 0.3), band };
    case "rect":
    default: {
      const { perSide } = rectSeats(n, t);
      return { len: Math.max(1.2, perSide * pitch), depth: band, band };
    }
  }
}

function rectSeats(n: number, o: ShapeOptions): { endSeats: number; long: number; perSide: number } {
  const endSeats = o.ends && n >= 3 ? 2 : 0;
  const long = n - endSeats;
  const perSide = o.one_side ? long : Math.ceil(long / 2);
  return { endSeats, long, perSide };
}

const TAU = Math.PI * 2;

function circlePts(rx: number, ry: number, k = 48, cy = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU;
    out.push({ x: Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

/** A stadium (rect with round ends): length len, depth d, as a closed polygon starting at the top centre, clockwise. */
function stadiumPts(len: number, d: number, k = 16): Pt[] {
  const r = d / 2;
  const s = Math.max(0, len / 2 - r);
  const out: Pt[] = [{ x: 0, y: -r }, { x: s, y: -r }];
  for (let i = 1; i < k; i++) {
    const a = -Math.PI / 2 + (i / k) * Math.PI;
    out.push({ x: s + Math.cos(a) * r, y: Math.sin(a) * r });
  }
  out.push({ x: s, y: r }, { x: -s, y: r });
  for (let i = 1; i < k; i++) {
    const a = Math.PI / 2 + (i / k) * Math.PI;
    out.push({ x: -s + Math.cos(a) * r, y: Math.sin(a) * r });
  }
  out.push({ x: -s, y: -r });
  return out;
}

/** Points along a polyline, `n` of them spread by arc length, each in the middle of its share. */
export function sampleAlong(pts: Pt[], n: number, closed: boolean): Pt[] {
  if (n <= 0 || pts.length === 0) return [];
  const path = closed ? [...pts, pts[0]] : pts;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    seg.push(d);
    total += d;
  }
  if (total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out: Pt[] = [];
  let j = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const target = ((i + 0.5) / n) * total;
    while (j < seg.length - 1 && acc + seg[j] < target) acc += seg[j++];
    const f = seg[j] ? (target - acc) / seg[j] : 0;
    out.push({ x: path[j].x + (path[j + 1].x - path[j].x) * f, y: path[j].y + (path[j + 1].y - path[j].y) * f });
  }
  return out;
}

/** The serpentine's centre line: `segments` arcs that alternate their bend, laid flat (chord along x) and centred. */
function serpentineLine(len: number, segments: number): Pt[] {
  const sweep = (80 * Math.PI) / 180;
  const r = len / (segments * sweep);
  const steps = 18;
  const pts: Pt[] = [{ x: 0, y: 0 }];
  let heading = -sweep / 2; // starts climbing so the S ends level
  let p = { x: 0, y: 0 };
  for (let s = 0; s < segments; s++) {
    const bend = s % 2 === 0 ? 1 : -1;
    for (let i = 0; i < steps; i++) {
      const dh = (bend * sweep) / steps;
      const ds = r * (sweep / steps);
      const mid = heading + dh / 2;
      p = { x: p.x + Math.cos(mid) * ds, y: p.y + Math.sin(mid) * ds };
      heading += dh;
      pts.push(p);
    }
  }
  // Lay the chord flat, then put the middle of the line on (0, 0): the table's number
  // sits on the table top, not in the air beside a curve.
  const last = pts[pts.length - 1];
  const a = -Math.atan2(last.y, last.x);
  const turned = pts.map((q) => ({ x: q.x * Math.cos(a) - q.y * Math.sin(a), y: q.x * Math.sin(a) + q.y * Math.cos(a) }));
  const mid = turned[Math.floor(turned.length / 2)];
  return turned.map((q) => ({ x: q.x - mid.x, y: q.y - mid.y }));
}

/** A polyline moved `d` to its left (negative d: to its right). */
function offsetLine(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dy / l) * d, y: p.y - (dx / l) * d };
  });
}

function segmentsOf(len: number, o: ShapeOptions, band: number): number {
  if (o.segments) return o.segments;
  // About one curved section for every 2.4 table lengths (in the units given).
  return Math.min(6, Math.max(2, Math.round(len / (band * 3.2))));
}

/** The body outline, centred, unrotated, as a closed polygon. */
export function shapeOutline(shape: TableShape, dims: ShapeDims, o: ShapeOptions = {}): Pt[] {
  const { len, depth, band } = dims;
  switch (shape) {
    case "round":
    case "cocktail":
      return circlePts(len / 2, len / 2);
    case "oval":
      return circlePts(len / 2, depth / 2);
    case "imperial":
      return stadiumPts(len, depth);
    case "half_moon": {
      // A half disc of diameter len, flat side up, centred on its own box (depth is len / 2).
      const r = len / 2;
      const out: Pt[] = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI;
        out.push({ x: Math.cos(a) * r, y: -r / 2 + Math.sin(a) * r });
      }
      return out;
    }
    case "serpentine": {
      const line = serpentineLine(len, segmentsOf(len, o, band));
      return [...offsetLine(line, band / 2), ...offsetLine(line, -band / 2).reverse()];
    }
    case "u_shape": {
      const L = len / 2;
      const D = depth / 2;
      const b = Math.min(band, len / 3, depth / 2);
      return [
        { x: -L, y: -D },
        { x: -L + b, y: -D },
        { x: -L + b, y: D - b },
        { x: L - b, y: D - b },
        { x: L - b, y: -D },
        { x: L, y: -D },
        { x: L, y: D },
        { x: -L, y: D },
      ];
    }
    case "square":
    case "rect":
    default:
      return [
        { x: -len / 2, y: -depth / 2 },
        { x: len / 2, y: -depth / 2 },
        { x: len / 2, y: depth / 2 },
        { x: -len / 2, y: depth / 2 },
      ];
  }
}

/** Seats evenly along a straight edge from a to b, each in the middle of its share. */
function along(a: Pt, b: Pt, k: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const f = (i + 0.5) / k;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}

/**
 * Where the chairs stand: `n` points `gap` outside the body edge, centred,
 * unrotated, in the units of `dims`. Half moons seat on the curved side only;
 * U tables on the outside; long tables on both sides (optionally the ends, or
 * one side for a head table).
 */
export function shapeSeats(shape: TableShape, n: number, dims: ShapeDims, gap: number, o: ShapeOptions = {}): Pt[] {
  const count = Math.max(0, Math.round(n));
  if (!count) return [];
  const { len, depth, band } = dims;
  switch (shape) {
    case "round":
    case "cocktail": {
      const r = len / 2 + gap;
      return Array.from({ length: count }, (_, i) => {
        const a = -Math.PI / 2 + (i * TAU) / count;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      });
    }
    case "oval":
      return sampleAlong(circlePts(len / 2 + gap, depth / 2 + gap, 96), count, true);
    case "imperial":
      return sampleAlong(stadiumPts(len + gap * 2, depth + gap * 2, 24), count, true);
    case "half_moon": {
      const r = len / 2 + gap;
      return Array.from({ length: count }, (_, i) => {
        const a = (Math.PI * (i + 0.5)) / count;
        return { x: Math.cos(a) * r, y: -len / 4 + Math.sin(a) * r };
      });
    }
    case "serpentine": {
      const line = serpentineLine(len, segmentsOf(len, o, band));
      const left = Math.ceil(count / 2);
      return [
        ...sampleAlong(offsetLine(line, band / 2 + gap), left, false),
        ...sampleAlong(offsetLine(line, -(band / 2 + gap)), count - left, false),
      ];
    }
    case "u_shape": {
      const L = len / 2 + gap;
      const D = depth / 2;
      return sampleAlong(
        [
          { x: -L, y: -D },
          { x: -L, y: D + gap },
          { x: L, y: D + gap },
          { x: L, y: -D },
        ],
        count,
        false
      );
    }
    case "square": {
      const per = [0, 0, 0, 0];
      for (let i = 0; i < count; i++) per[[0, 2, 1, 3][i % 4]]++;
      const h = len / 2;
      const g = h + gap;
      return [
        ...along({ x: -h, y: -g }, { x: h, y: -g }, per[0]),
        ...along({ x: g, y: -h }, { x: g, y: h }, per[1]),
        ...along({ x: h, y: g }, { x: -h, y: g }, per[2]),
        ...along({ x: -g, y: h }, { x: -g, y: -h }, per[3]),
      ];
    }
    case "rect":
    default: {
      const { endSeats, long } = rectSeats(count, o);
      const top = o.one_side ? long : Math.ceil(long / 2);
      const bottom = long - top;
      const x = len / 2;
      const y = depth / 2 + gap;
      const out = [...along({ x: -x, y: -y }, { x, y: -y }, top), ...along({ x, y }, { x: -x, y }, bottom)];
      if (endSeats) out.push({ x: x + gap, y: 0 }, { x: -x - gap, y: 0 });
      return out;
    }
  }
}

/**
 * Where a table's number sits, unturned, on its own table top. The middle for
 * every shape but the U, whose middle is the floor inside it: there the number
 * sits on the base bar (review round 3). `labelH` (same units) is the height of
 * the number: on a bar thinner than it, the number moves up the bar so it does
 * not cover the chairs below, but its centre stays on the bar.
 */
export function labelAnchor(shape: TableShape, dims: ShapeDims, labelH = 0): Pt {
  if (shape === "u_shape") {
    const D = dims.depth / 2;
    const b = Math.min(dims.band, dims.len / 3, D);
    const up = Math.max(b / 2, Math.min(D, labelH / 2 + 1));
    return { x: 0, y: Math.max(D - b * 0.9, D - up) };
  }
  return { x: 0, y: 0 };
}

/**
 * Shapes whose table top is narrower than their number (a U's bar, a
 * serpentine's curved band): the number gets a small plate in the table's own
 * colours, so a full table's light ink never lands on the floor and no edge
 * runs through the letters.
 */
export function labelOnPlate(shape: TableShape): boolean {
  return shape === "u_shape" || shape === "serpentine";
}

/** Turn points clockwise by `deg` degrees around (0, 0) (y points down, as on screen). */
export function rotatePts(pts: Pt[], deg: number): Pt[] {
  if (!deg) return pts;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** The box around points that stays centred on (0, 0): width and height twice the farthest reach. */
export function centredExtent(pts: Pt[], pad = 0): { w: number; h: number } {
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    mx = Math.max(mx, Math.abs(p.x));
    my = Math.max(my, Math.abs(p.y));
  }
  return { w: (mx + pad) * 2, h: (my + pad) * 2 };
}

/** A polygon as an SVG path ("M x y L ... Z"), numbers to 2 decimals. */
export function pathOf(pts: Pt[], dx = 0, dy = 0): string {
  if (!pts.length) return "";
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  return `M${pts.map((p) => `${f(p.x + dx)} ${f(p.y + dy)}`).join(" L")} Z`;
}

/** The whole drawing of one table in metres (body and chairs), turned. Used by the PDF and the app payload. */
export function tableDrawing(
  t: { shape: TableShape; capacity: number } & ShapeOptions,
  sizes: ShapeSizes = DEFAULT_SHAPE_SIZES,
  gap = CHAIR_GAP_M
): { body: Pt[]; seats: Pt[]; dims: ShapeDims } {
  const dims = shapeDims(t, sizes);
  const o = cleanShapeOptions(t.shape, t);
  const rot = o.rotation ?? 0;
  return {
    dims,
    body: rotatePts(shapeOutline(t.shape, dims, o), rot),
    seats: rotatePts(shapeSeats(t.shape, t.capacity, dims, gap, o), rot),
  };
}

/** The curved sections a serpentine is drawn with (its own choice, else about one per 2.4 m). */
export function serpentineSections(t: { shape: TableShape; capacity: number } & ShapeOptions, sizes: ShapeSizes = DEFAULT_SHAPE_SIZES): number {
  const d = shapeDims({ ...t, shape: "serpentine" }, sizes);
  return segmentsOf(d.len, cleanShapeOptions("serpentine", t), d.band);
}
