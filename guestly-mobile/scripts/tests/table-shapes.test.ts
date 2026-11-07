// Run: node --experimental-strip-types scripts/tests/table-shapes.test.ts
// #55 table shapes, the app's read side (src/features/seating/shapeView.ts on
// the verbatim geometry ./tableShapes.ts): what a payload table draws as
// (unknown shapes draw shape_fallback), chairs at their places, long tables
// longer, turns respected, the plan keeps every table inside it, the words
// VoiceOver reads (EN and ES, the portal's shape names), the day pack's
// tables, and static checks that every read view draws from these rules.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const sv = await import("../../src/features/seating/shapeView.ts");
const geo = await import("../../src/features/seating/tableShapes.ts");
const pack = await import("../../src/features/dayof/packCore.ts");

let n = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

const SHAPES = geo.TABLE_SHAPES as readonly string[];
const opts = { gap: 4, dot: 2 };

t("every shape the portal sends draws as itself", () => {
  assert.equal(SHAPES.length, 9);
  for (const s of SHAPES) {
    const d = sv.readShape({ shape: s, shape_fallback: geo.legacyShape(s) });
    assert.equal(d.shape, s);
    assert.equal(d.known, true);
    assert.equal(d.sent, s);
  }
});

t("an unknown future shape draws its shape_fallback, with no options", () => {
  const d = sv.readShape({ shape: "chevron", shape_fallback: "rect", rotation: 30, ends: true });
  assert.deepEqual(d, { shape: "rect", sent: "chevron", known: false, options: {} });
  assert.equal(sv.readShape({ shape: "zigzag", shape_fallback: "round" }).shape, "round");
  // No usable fallback: round, the way the portal reads an unknown word.
  assert.equal(sv.readShape({ shape: "zigzag" }).shape, "round");
  assert.equal(sv.readShape({ shape: "zigzag", shape_fallback: "imperial" }).shape, "round");
  assert.equal(sv.readShape({}).shape, "round");
});

t("1.3-era answers (round or rect only, no new field) draw as before", () => {
  assert.deepEqual(sv.readShape({ shape: "round" }), { shape: "round", sent: "round", known: true, options: {} });
  assert.deepEqual(sv.readShape({ shape: "rect" }), { shape: "rect", sent: "rect", known: true, options: {} });
});

t("options are read the portal's way (turn folded, ends and one side for rect only)", () => {
  assert.deepEqual(sv.readShape({ shape: "rect", rotation: 270, ends: true, one_side: true }).options, { rotation: 90, ends: true, one_side: true });
  assert.deepEqual(sv.readShape({ shape: "oval", rotation: 200, ends: true }).options, { rotation: 20 });
  assert.deepEqual(sv.readShape({ shape: "round", rotation: 45 }).options, {});
  assert.deepEqual(sv.readShape({ shape: "serpentine", segments: 4 }).options, { segments: 4 });
});

t("one chair per seat, for every shape at usual and odd counts", () => {
  for (const s of SHAPES) {
    for (const cap of [1, 4, 5, 8, 12, 16, 20, 24]) {
      const art = sv.tableArt({ capacity: cap, ...sv.readShape({ shape: s }) }, { ppm: 14, gap: 5, dot: 2.6, minBody: 26, maxLen: 120 });
      assert.equal(art.seats.length, cap, `${s} ${cap}`);
      for (const p of art.seats) {
        assert.ok(p.x >= 0 && p.x <= art.w && p.y >= 0 && p.y <= art.h, `${s} ${cap}: chair inside its box`);
      }
      assert.ok(art.body.startsWith("M"), s);
    }
  }
});

t("long tables scale with length", () => {
  const draw = (shape: string, cap: number) => sv.tableArt({ capacity: cap, ...sv.readShape({ shape }) }, { ppm: 14, gap: 5, dot: 2.6, minBody: 26, maxLen: 1000 });
  assert.ok(draw("imperial", 20).w > draw("imperial", 12).w, "imperial 20 is longer than 12");
  assert.ok(draw("rect", 16).w > draw("rect", 8).w, "banquet 16 is longer than 8");
  assert.ok(draw("serpentine", 24).w > draw("serpentine", 12).w, "serpentine");
  // 0.61 m a seat: the 8-seat banquet is the configured 2.44 m at 14 pt a metre.
  assert.ok(Math.abs(geo.shapeDims({ shape: "rect", capacity: 8 }).len - 2.44) < 1e-9);
  // Capped: a 40-seat banquet never passes maxLen on the plan.
  const long = sv.tableArt({ capacity: 40, ...sv.readShape({ shape: "rect" }) }, { ppm: 14, gap: 5, dot: 2.6, minBody: 26, maxLen: 105 });
  assert.ok(long.k * geo.shapeDims({ shape: "rect", capacity: 40 }).len <= 105.01);
});

t("rotation is respected", () => {
  const o = { ppm: 14, gap: 5, dot: 2.6, minBody: 26, maxLen: 1000 };
  const flat = sv.tableArt({ capacity: 12, ...sv.readShape({ shape: "rect" }) }, o);
  const turned = sv.tableArt({ capacity: 12, ...sv.readShape({ shape: "rect", rotation: 90 }) }, o);
  assert.ok(flat.w > flat.h * 1.5, "a long table lies along x");
  assert.ok(Math.abs(turned.w - flat.h) <= 2 && Math.abs(turned.h - flat.w) <= 2, "turned 90 it stands along y");
  const half = sv.tableArt({ capacity: 5, ...sv.readShape({ shape: "half_moon", rotation: 180 }) }, o);
  const up = sv.tableArt({ capacity: 5, ...sv.readShape({ shape: "half_moon" }) }, o);
  const meanY = (a: { seats: { y: number }[]; h: number }) => a.seats.reduce((s, p) => s + p.y, 0) / a.seats.length - a.h / 2;
  assert.ok(meanY(up) > 0 && meanY(half) < 0, "a half moon turned 180 seats the other way");
});

t("a table fitted to a box stays inside it (list marks, the table screen)", () => {
  for (const s of SHAPES) {
    for (const cap of [2, 8, 20, 24]) {
      for (const box of [40, 150]) {
        const a = sv.fitArt({ capacity: cap, ...sv.readShape({ shape: s, rotation: 30 }) }, box, box, opts);
        assert.ok(a.w <= box && a.h <= box, `${s} ${cap} in ${box}: ${a.w}x${a.h}`);
        assert.equal(a.seats.length, cap);
      }
    }
  }
});

t("the plan keeps every table inside it, one scale, grid spots for unsaved tables", () => {
  const tables = SHAPES.map((s, i) => ({ id: `t${i}`, label: `Mesa ${i + 1}`, capacity: geo.DEFAULT_SHAPE_CAPACITY[s as keyof typeof geo.DEFAULT_SHAPE_CAPACITY], shape: s, x: i % 2 ? 0.98 : 0.02, y: i % 3 ? 0.01 : 0.99, rotation: 30 }));
  const laid = sv.planLayout([...tables, { id: "new", label: "Nueva", capacity: 8, shape: "round" }], 350, 262);
  assert.equal(laid.length, 10);
  for (const p of laid) {
    assert.ok(p.left >= -0.01 && p.top >= -0.01, p.id);
    assert.ok(p.left + p.art.w <= 350.01 && p.top + p.art.h <= 262.01, p.id);
  }
  const fresh = laid.find((p) => p.id === "new")!;
  // The tenth table without a place takes the server's next grid spot (index 9: column 1, row 2).
  assert.ok(Math.abs(fresh.left + fresh.art.w / 2 - Math.min(0.95, 0.15 + 0.23) * 350) < 1);
  assert.equal(laid.find((p) => p.id === "t0")!.mark, "1");
  assert.equal(sv.tableMark("Familia Pérez"), "FP");
  assert.equal(sv.tableMark("Novios"), "Nov");
  // Long tables longer than round ones on the same plan.
  const imp = laid.find((p) => p.drawn.shape === "imperial")!;
  const round = laid.find((p) => p.drawn.shape === "round")!;
  assert.ok(Math.max(imp.art.w, imp.art.h) > Math.max(round.art.w, round.art.h));
});

t("VoiceOver names the shape and the seats, EN and ES", () => {
  assert.equal(sv.tableA11y("en", { label: "Table 4", shape: "imperial", capacity: 20, seated: 12 }), "Table 4, Imperial, 20 seats, 12 seated");
  assert.equal(sv.tableA11y("es", { label: "Mesa 4", shape: "imperial", capacity: 20, seated: 12 }), "Mesa 4, Imperial, 20 lugares, 12 ocupados");
  assert.equal(sv.tableA11y("es", { label: "Barra", shape: "cocktail", capacity: 1, seated: 1 }), "Barra, Cóctel, 1 lugar, 1 ocupado");
  assert.equal(sv.tableA11y("en", { label: "Head", shape: "rect", capacity: 9, seated: 10, over: true }), "Head, Rectangular, 9 seats, 10 seated, more people than seats");
  assert.equal(sv.tableA11y("es", { label: "Mesa U", shape: "u_shape", capacity: 24 }), "Mesa U, En U, 24 lugares");
  assert.deepEqual(Object.values(sv.SHAPE_NAMES.es), ["Redonda", "Cuadrada", "Rectangular", "Ovalada", "Media luna", "Serpentina", "Imperial", "Cóctel", "En U"]);
  for (const lang of ["en", "es"] as const) {
    assert.deepEqual(Object.keys(sv.SHAPE_NAMES[lang]).sort(), [...SHAPES].sort());
    for (const v of Object.values(sv.SHAPE_NAMES[lang])) assert.ok(!/[–—!]/.test(v));
  }
});

t("shape names equal the portal's (src/lib/i18n/seating-shapes.ts)", () => {
  const portal = process.env.GL_PORTAL_DIR || "/Users/nicolas_z/gl-mw/integration";
  const file = path.join(portal, "src/lib/i18n/seating-shapes.ts");
  if (!existsSync(file)) {
    console.warn(`WARN  ${file} not found, shape name parity skipped`);
    return;
  }
  const text = readFileSync(file, "utf8");
  for (const lang of ["es", "en"] as const) {
    const block = new RegExp(`\\n  ${lang}: \\{\\n    names: \\{([\\s\\S]*?)\\n    \\}`).exec(text);
    assert.ok(block, `portal ${lang} names`);
    const names = Object.fromEntries([...block[1].matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
    assert.deepEqual(names, sv.SHAPE_NAMES[lang], `${lang} names word for word`);
  }
});

t("day pack tables: shapes, places and seated counts read; older packs still draw", () => {
  const raw = {
    meta: { version: "v1", generated_at: "2026-11-07T10:00:00Z", tz: "America/La_Paz", wedding_date: "2026-11-27", valid_until: "2026-11-28", server_now: "2026-11-07T10:00:00Z", slug: "x", couple_names: "A y B", can_mark_status: true },
    runsheet: [],
    places: [],
    vendors: [],
    roster: [],
    contacts: [],
    seating: {
      tables: [
        { id: "a", name: "Imperial", number: 1, seats: 20, shape: "imperial", shape_fallback: "rect", x: 0.5, y: 0.3, rotation: 90 },
        { id: "b", name: "Mesa 2", number: 2, seats: 10, shape: "zigzag", shape_fallback: "rect", x: 0.2, y: 0.7, ends: "yes" },
        { id: "c", name: "Old", number: null, seats: 8 },
        { id: "", name: "No id", number: null, seats: 8 },
      ],
      assignments: [
        { guest_id: "g1", table_id: "a", seat: null, person: "Ana" },
        { guest_id: "g2", table_id: "a", seat: null, person: "Beto" },
        { guest_id: "g3", table_id: "c", seat: null, person: "Caro" },
      ],
      floor_plan_url: null,
    },
  };
  const p = pack.parsePack ? pack.parsePack(raw) : null;
  assert.ok(p, "parsePack exported");
  const tables = p!.seating!.tables;
  assert.deepEqual(tables[0], { id: "a", name: "Imperial", number: 1, seats: 20, shape: "imperial", shape_fallback: "rect", x: 0.5, y: 0.3, rotation: 90 });
  assert.equal(tables[1].ends, undefined, "only true counts");
  const plan = pack.packPlanTables(p!.seating);
  assert.deepEqual(plan.map((x) => [x.id, x.seated, x.capacity]), [["a", 2, 20], ["b", 0, 10], ["c", 1, 8]]);
  assert.equal(sv.readShape(plan[0]).shape, "imperial");
  assert.equal(sv.readShape(plan[1]).shape, "rect", "unknown shape: the fallback");
  assert.equal(sv.readShape(plan[2]).shape, "round", "a pack from before the shapes");
  assert.deepEqual(pack.packPlanTables(null), []);
});

t("static: every read view draws from these rules", () => {
  const couple = src("src/app/couple/(tools)/seating/index.tsx");
  assert.match(couple, /<TableMark /);
  assert.match(couple, /<SeatingPlanMap /);
  assert.ok(!/borderRadius: t\.shape === "round"/.test(couple), "the old round-or-square box is gone");
  const table = src("src/app/couple/(tools)/seating/table/[id].tsx");
  assert.match(table, /<TableMark [^>]*size=\{150\}/);
  assert.match(table, /accessibilityLabel=\{tableA11y\(/);
  assert.match(table, /table\.shape !== "round" && table\.shape !== "rect"/, "a web shape stays a choice, so a save keeps it");
  const planner = src("src/app/planner/(tools)/seating.tsx");
  assert.match(planner, /<SeatingPlanMap /);
  assert.match(planner, /<TableMark /);
  const live = src("src/features/dayof/LiveDay.tsx");
  assert.match(live, /packPlanTables\(pack\.seating\)/);
  assert.match(live, /<SeatingPlanMap /);
  const comp = src("src/features/seating/TableShape.tsx");
  assert.match(comp, /accessibilityLabel=\{tableA11y\(/);
  // The save sends the word it was sent back unchanged (round or rect only when the person picks one).
  const hooks = src("src/features/seating/hooks.ts");
  assert.match(hooks, /shape: t\.shape,\n\s+\}\)\),\n\s+assignments: draft\.assignments/);
});

console.log(`table-shapes: ${n} groups passed`);
