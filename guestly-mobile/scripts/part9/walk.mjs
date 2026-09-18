// Walks the route manifest for ONE device, role and language.
//
//   node scripts/part9/walk.mjs --device S --role couple --lang es
//
//   --device   S | M | L | T | P (env.sh) or a raw UDID
//   --role     none | guest | couple | planner   (none = the signed-out set)
//   --lang     en | es
//   --session  fresh (default: inject a new session) | keep (language only, no grant) | skip (touch nothing)
//   --only     comma list of route ids, for example C01,C24
//   --limit    walk only the first N routes
//   --wait     ms to wait after each deep link (default 3500; routes may override with wait_ms)
//   --scroll   also capture up to 4 scrolled pages per screen through Maestro (slow)
//   --tag      sub folder under the role, for example A1-empty or A3-fail (default: none)
//   --no-prep  skip the Maestro prep flow (Open-in sheet, dev menu). Only on a device where prep already ran
//              for BOTH schemes; on a fresh simulator the system sheet blocks every deep link.
//
// Output: .part9/shots/<device>/<lang>/<role>[/<tag>]/<id>-<state>.png, a
// 1400 px JPEG twin under jpg/ (cheap to read), and index.json.
// A screenshot is NOT a pass. Every image must be opened and looked at: the
// launcher, a redirect, a system sheet or a skeleton is a harness miss.
//
// Live API manners: links that mint or open a guest session (/i/...) are
// paced seven seconds apart (10 calls a minute per IP on /auth/guest/open).

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { HERE, PART9, ROOT, launchApp, maestro as runMaestro, openRoute, parseArgs, readJson, sleep, udidOf, writeJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const device = String(args.device ?? "");
const udid = udidOf(device);
const role = String(args.role ?? "");
const lang = args.lang === "es" ? "es" : "en";
const session = String(args.session ?? "fresh");
const baseWait = Number(args.wait ?? 3500);
const release = (process.env.GL_BINARY ?? "dev") === "release";
if (!udid || !["none", "guest", "couple", "planner"].includes(role)) {
  console.error("usage: walk.mjs --device <S|M|L|T|P|udid> --role none|guest|couple|planner --lang en|es [--session fresh|keep|skip] [--only ids] [--limit n] [--wait ms] [--scroll] [--tag name] [--no-prep]");
  process.exit(2);
}

const label = device.length === 1 ? device.toUpperCase() : udid.slice(0, 8);
const outDir = path.join(PART9, "shots", label, lang, role, ...(args.tag ? [String(args.tag)] : []));
const jpgDir = path.join(outDir, "jpg");
fs.mkdirSync(jpgDir, { recursive: true });

const manifest = readJson(path.join(HERE, "routes.json"), { routes: [] });
const ids = readJson(path.join(PART9, "ids.json"), {});

function lookup(pathExpr) {
  return pathExpr.split(".").reduce((o, k) => (o == null ? o : o[k]), ids);
}

/** Expands placeholders; returns [{ route, suffix }] or a skip reason. */
function expand(r) {
  if (r.each) {
    const list = lookup(r.each);
    if (!Array.isArray(list) || !list.length) return { skip: `no list ${r.each}` };
    return { routes: list.map((item) => ({ route: r.route.replace("{item}", item), suffix: `-${item}` })) };
  }
  let missing = null;
  const route = r.route.replace(/\{([a-z_.]+)\}/g, (_, expr) => {
    const v = lookup(expr);
    if (v == null) missing = expr;
    return v ?? "";
  });
  if (missing) return { skip: `no id for ${missing} (list is empty; run seed-demo.mjs then resolve-ids.mjs)` };
  return { routes: [{ route, suffix: "" }] };
}

function shot(file) {
  execFileSync("xcrun", ["simctl", "io", udid, "screenshot", "--type=png", file], { stdio: "ignore" });
  const jpg = path.join(jpgDir, path.basename(file).replace(/\.png$/, ".jpg"));
  spawnSync("sips", ["-Z", "1400", file, "--out", jpg, "-s", "format", "jpeg", "-s", "formatOptions", "80"], { stdio: "ignore" });
  return jpg;
}

const maestro = (flow, env, opts) => runMaestro(udid, flow, env, opts);

async function main() {
  const routes = manifest.routes
    .filter((r) => r.role === role)
    .filter((r) => (args.only ? String(args.only).split(",").includes(r.id) : true))
    .slice(0, args.limit ? Number(args.limit) : undefined);
  if (!routes.length) throw new Error("no routes match");

  if (session !== "skip") {
    const injectRole = session === "keep" ? "keep" : role;
    const r = spawnSync("node", [path.join(HERE, "inject-session.mjs"), "--udid", udid, "--role", injectRole, "--lang", lang], { stdio: "inherit", env: process.env });
    if (r.status !== 0) throw new Error("session injection failed");
  }

  // First guestly:// link on a fresh simulator raises the system "Open in" sheet.
  if (!args["no-prep"]) {
    openRoute(udid, role === "none" ? "/" : `/${role}`);
    await sleep(2500);
    maestro("prep.yaml");
    await sleep(1500);
  }

  const index = { device: label, udid, role, lang, tag: args.tag ?? null, binary: process.env.GL_BINARY ?? "dev", started_at: new Date().toISOString(), shots: [] };
  let lastGuestLink = 0;

  for (const r of routes) {
    const state = r.states[0];
    if (r.via !== "deeplink") {
      index.shots.push({ id: r.id, route: r.route, state, status: "skipped", reason: `needs ${r.via}: ${r.note ?? ""}` });
      continue;
    }
    const ex = expand(r);
    if (ex.skip) {
      index.shots.push({ id: r.id, route: r.route, state, status: "skipped", reason: ex.skip });
      console.log(`${r.id}  skipped  ${ex.skip}`);
      continue;
    }
    for (const { route, suffix } of ex.routes) {
      if (route.startsWith("/i/")) {
        const since = Date.now() - lastGuestLink;
        if (since < 7000) await sleep(7000 - since);
        lastGuestLink = Date.now();
      }
      try {
        openRoute(udid, route);
      } catch (err) {
        index.shots.push({ id: r.id, route, state, status: "error", reason: String(err.message).slice(0, 200) });
        continue;
      }
      await sleep(r.wait_ms ?? baseWait);
      const name = `${r.id}${suffix}-${state}`;
      const file = path.join(outDir, `${name}.png`);
      const jpg = shot(file);
      const entry = { id: r.id, route, state, status: "captured", file: path.relative(ROOT, file), jpg: path.relative(ROOT, jpg), other_states: r.states.slice(1), at: new Date().toISOString() };
      if (args.scroll) {
        const ok = maestro("scroll-shots.yaml", { NAME: `${name}-scroll` }, { shotsTo: outDir });
        entry.scroll = ok ? "captured" : "failed";
      }
      index.shots.push(entry);
      console.log(`${r.id}${suffix}  captured  ${route}`);
      // A deep link opened while a modal is up lands underneath it (seen on the
      // first planner walk). Relaunch so the next route starts from a clean stack.
      if (r.modal) {
        launchApp(udid);
        await sleep(release ? 5000 : 9000);
      }
    }
  }

  index.finished_at = new Date().toISOString();
  writeJson(path.join(outDir, "index.json"), index);
  const captured = index.shots.filter((s) => s.status === "captured").length;
  const skipped = index.shots.filter((s) => s.status === "skipped").length;
  console.log(`done: ${captured} captured, ${skipped} skipped. ${path.relative(ROOT, outDir)}/index.json`);
  console.log("Now READ the images. A capture is not a pass.");
}

main().catch((err) => {
  console.error(`walk failed: ${err.message}`);
  process.exit(1);
});
