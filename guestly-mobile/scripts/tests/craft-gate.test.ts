// Run: node --experimental-strip-types scripts/tests/craft-gate.test.ts
// The app craft gate (K17, Master Wave L8, Nov 5 2026): every pattern catches its
// fixture and lets the sanctioned form through, comments never count, the ratchet
// fails both ways, and src/ passes against scripts/craft-gate.config.json today.
import assert from "node:assert/strict";
import { scanText, stripComments, judge, measure, loadConfig, PATTERNS } from "../craft-gate.mjs";

const count = (src: string, file = "src/features/x/Screen.tsx") => {
  const hits = scanText(src, file) as Record<string, unknown[]>;
  return Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])) as Record<string, number>;
};
const only = (src: string, pattern: string, n: number, file?: string) => {
  const c = count(src, file);
  assert.equal(c[pattern], n, `${pattern} in: ${src}`);
};

// Comments are not UI.
assert.equal(stripComments('a // "★" ✓\nb').replace(/ +/g, " "), "a \nb", "a line comment blanks out, the newline stays");
assert.equal(stripComments("x /* Alert.alert(e) */ y").includes("Alert"), false);
assert.equal(stripComments('const u = "https://x.y"; // c').startsWith('const u = "https://x.y";'), true, "a // inside a string stays");
assert.equal(stripComments("`a ${b /* c */} d` // e").trim(), "`a ${b        } d`");
only('// a ★ in a comment\nconst a = 1;', "glyph", 0);

// glyph
only('<T v="body15">{"★".repeat(n)}</T>', "glyph", 1);
only('<Badge label={on ? "✓" : ""} />', "glyph", 1);
only('<Tool label="↑" />', "glyph", 1);
only('const s = "\\u2192";', "glyph", 1);
only('<Icon name="star" />', "glyph", 0);
only('const sep = " · ";', "glyph", 0); // the middle dot is typography

// raw-hex
only('const s = { color: "#03694c" };', "raw-hex", 1);
only('<T color="#fff">x</T>', "raw-hex", 1);
only('night: "#0d1117",', "raw-hex", 0, "src/ui/tokens.ts");
only('fill: "#0d1117",', "raw-hex", 0, "src/widgets/GuestlyDayOf.tsx");
only('const anchor = "#section";', "raw-hex", 0);

// spinner-screen
only("<Screen>\n  <Loading label={x} />\n</Screen>", "spinner-screen", 1);
only("<Screen header={h}>\n  <ActivityIndicator color={c} />\n</Screen>", "spinner-screen", 1);
only("if (busy) return <ActivityIndicator />;", "spinner-screen", 1);
only("<Screen>\n  <Skeleton h={60} />\n</Screen>", "spinner-screen", 0);
only('<Button trailing={busy ? <ActivityIndicator /> : null} />', "spinner-screen", 0);

// pressable-a11y
only("<Pressable onPress={go} style={s}>\n  <T>{x}</T>\n</Pressable>", "pressable-a11y", 1);
only('<Pressable onPress={go} accessibilityRole="button">', "pressable-a11y", 0);
only("<Pressable\n  onPress={() => go(a > b)}\n  accessibilityLabel={label}\n>", "pressable-a11y", 0);
only("<Pressable accessible={false} onPress={go}>", "pressable-a11y", 0);
only("<Pressable {...props} />", "pressable-a11y", 0);

// literal-in-t
only('<T v="body15">Hello there</T>', "literal-in-t", 1);
only('<T v="body15">\n  Hola\n</T>', "literal-in-t", 1);
only('<T v="meta13">{"Loading"}</T>', "literal-in-t", 1);
only("<T v=\"meta13\">{`${n} guests`}</T>", "literal-in-t", 1);
only('<T v="body15">{copy.title}</T>', "literal-in-t", 0);
only('<T v="body15">{`${a} · ${b}`}</T>', "literal-in-t", 0);
only('<T v="display60">&amp;{" "}</T>', "literal-in-t", 0);
only("const [v, set] = useState<T>(init); // generic, not a tag", "literal-in-t", 0);

// alert-error: native alerts stay only for a choice with a Cancel button
only("Alert.alert(copy.common.error, errorText(err, lang, fb));", "alert-error", 1);
only("Alert.alert(copy.nothingRead);", "alert-error", 1);
only('Alert.alert(c.delete, c.deleteConfirm, [\n  { text: c.cancel, style: "cancel" },\n  { text: c.delete, style: "destructive", onPress: go },\n]);', "alert-error", 0);
only('Alert.alert(c.title, c.body, [{ text: c.notNow, style: "cancel" }, { text: c.openSettings, onPress: open }]);', "alert-error", 0);
only('Alert.alert(c.title, c.body, [{ text: c.ok, onPress: go }]);', "alert-error", 1);

// font-size
only("const s = { fontSize: 10 };", "font-size", 1);
only("const s = { fontSize: 11 };", "font-size", 0);
only("const s = { fontSize: 9.5 };", "font-size", 1);

// ivory25-text
only('<T v="body15" color={colors.ivory25}>{x}</T>', "ivory25-text", 1);
only('<T v="body15" color={off ? colors.ivory25 : colors.ivory}>{x}</T>', "ivory25-text", 1);
only("const s = { color: colors.ivory25 };", "ivory25-text", 1);
only("const s = { borderColor: colors.ivory25 };", "ivory25-text", 0);
only("const s = { backgroundColor: colors.ivory25 };", "ivory25-text", 0);
only('<T v="body15" color={colors.ivory40}>{x}</T>', "ivory25-text", 0);

// The ratchet fails both ways: over the ceiling, and a ceiling above the count.
const counts = Object.fromEntries(PATTERNS.map((p: string) => [p, {}])) as Record<string, Record<string, unknown[]>>;
counts.glyph["src/a.tsx"] = [{}, {}];
let r = judge(counts, { ceilings: { glyph: { "src/a.tsx": 1 } } });
assert.equal(r.over.length, 1, "2 hits over a ceiling of 1 fails");
r = judge(counts, { ceilings: { glyph: { "src/a.tsx": 3 } } });
assert.equal(r.stale.length, 1, "a ceiling of 3 over 2 hits is stale");
r = judge(counts, { ceilings: { glyph: { "src/a.tsx": 2 } } });
assert.equal(r.over.length + r.stale.length, 0, "at the ceiling passes");
counts.glyph["src/new.tsx"] = [{}];
assert.equal(judge(counts, { ceilings: { glyph: { "src/a.tsx": 2 } } }).over.length, 1, "a file without a ceiling is gated at 0");

// K17 is closed for good: no file may carry an error alert or ivory25 text.
const config = loadConfig();
assert.deepEqual(config.ceilings["alert-error"] ?? {}, {}, "no ceiling for alert-error: every error is a toast or inline");
assert.deepEqual(config.ceilings["ivory25-text"] ?? {}, {}, "no ceiling for ivory25-text");

// src/ against the committed ceilings.
const live = judge(measure(), config);
for (const o of live.over) console.error(`over: ${o.pattern} ${o.file} ${o.count} > ${o.ceiling}`);
for (const s of live.stale) console.error(`stale: ${s.pattern} ${s.file} ${s.count} < ${s.ceiling} (node scripts/craft-gate.mjs --ratchet)`);
assert.equal(live.over.length + live.stale.length, 0, "node scripts/craft-gate.mjs passes on src/");

console.log("craft-gate: all checks passed");
