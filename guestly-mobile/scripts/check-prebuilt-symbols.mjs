// Launch-crash guard (1.3.0 build 36, Oct 31 2026): Expo SDK 58 ships modules
// as prebuilt xcframeworks. A module prebuilt against a newer ExpoModulesCore
// than the one installed references Swift symbols the core does not export,
// and dyld kills the app at launch ("Symbol missing"). This unpacks every
// release prebuild in node_modules and checks each Swift symbol a framework
// imports from another prebuilt framework is exported by it. macOS only (nm).
// Usage: node scripts/check-prebuilt-symbols.mjs   (exit 1 on any miss)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const tars = [];
function walk(dir, depth) {
  if (depth > 9 || !existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, depth + 1);
    else if (name.endsWith(".tar.gz") && p.includes("/prebuilds/output/release/xcframeworks/")) tars.push(p);
  }
}
walk(join(root, "node_modules"), 0);

const work = mkdtempSync(join(tmpdir(), "prebuilt-"));
const frameworks = new Map(); // name -> binary path (first wins: npm hoisting order)
for (const t of tars) {
  const out = mkdtempSync(join(work, "x"));
  execFileSync("tar", ["-xzf", t, "-C", out]);
  for (const xcf of readdirSync(out).filter((n) => n.endsWith(".xcframework"))) {
    const name = xcf.replace(/\.xcframework$/, "");
    const bin = join(out, xcf, "ios-arm64", `${name}.framework`, name);
    if (existsSync(bin) && !frameworks.has(name)) frameworks.set(name, { bin, from: t.replace(root, "") });
  }
}

const nm = (args, bin) => execFileSync("nm", [...args, bin], { maxBuffer: 1 << 28 }).toString().split("\n");
const exported = new Map();
for (const [name, f] of frameworks) exported.set(name, new Set(nm(["-gU"], f.bin).map((l) => l.trim().split(/\s+/).pop())));

// Swift mangling: _$s<len><Module>... names the defining module.
const owner = (sym) => {
  const m = /^_\$s(\d+)/.exec(sym);
  return m ? sym.slice(m[0].length, m[0].length + Number(m[1])) : null;
};

let misses = 0;
for (const [name, f] of frameworks) {
  for (const line of nm(["-u"], f.bin)) {
    const sym = line.trim();
    const mod = owner(sym);
    if (!mod || mod === name || !exported.has(mod)) continue;
    if (!exported.get(mod).has(sym)) {
      misses++;
      if (misses <= 20) console.error(`MISSING ${name} needs ${sym} from ${mod}`);
    }
  }
}
rmSync(work, { recursive: true, force: true });
console.log(`${frameworks.size} prebuilt frameworks, ${misses} missing cross-framework symbols`);
process.exit(misses ? 1 : 0);
