// Web rig: the secondary layout check at 360, 390, 430, 768, 1024 and 1440 px.
// A native app has no web target; this is a proxy for small Android phones
// and large windows. It CLICKS through the UI like a person (no goto on deep
// paths), in EN and ES, for the signed-out set, the guest, the couple and the
// planner, and records horizontal overflow for every screen.
//
//   cd guestly-mobile && npx expo export -p web --output-dir .part9/web
//   node scripts/part9/web-rig.mjs                       everything
//   node scripts/part9/web-rig.mjs --roles none,guest --widths 360,1440 --langs es [--out .part9/web-shots-fix1]
//
// Output: .part9/web-shots/<role>/<lang>/<width>/NN-name.png and index.json
// (with overflow_px per screen; anything above 0 is a horizontal scroll bug).
//
// Safety
//   * Only demo-review: demo couple, demo planner, invite CAMAND and Sofia Rojas.
//   * The Supabase OTP endpoint is intercepted for the whole run and answered
//     locally with 200 {}. No sign-in email can leave this machine. If the
//     interception is not armed the run aborts.
//   * Never clicks sign out, leave, delete, send, remind, approve or decline.
//     The guest RSVP screen is captured and scrolled; its submit is never clicked.
//   * One sign-in per role for the whole run (live API rate limits). Language
//     and width change by local storage and viewport, not by signing in again.
//   * Chromium runs with --disable-web-security because the live API sends no
//     CORS headers for localhost. That flag is for this local rig only.
//   * Tracing, video and HAR are off. Credentials come from the gitignored
//     credentials/demo-accounts.env and are never printed.
//   * The guest token lives in localStorage on web (src/lib/secure.web.ts),
//     which is never part of a native build.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { PART9, ROOT, loadEnv, parseArgs, writeJson } from "./lib.mjs";

const PLAYWRIGHT = "/Users/nicolas_z/Desktop/guest-ly/guestly-portal/node_modules/playwright/index.mjs";
const args = parseArgs(process.argv.slice(2));
const PORT = Number(process.env.GL_WEB_PORT ?? 8793);
const WEB_DIR = path.join(PART9, "web");
const OUT = args.out ? path.resolve(ROOT, String(args.out)) : path.join(PART9, "web-shots");
const VIEWPORTS = { 360: 740, 390: 844, 430: 932, 768: 1024, 1024: 1366, 1440: 900 };
const widths = (args.widths ? String(args.widths).split(",").map(Number) : Object.keys(VIEWPORTS).map(Number)).filter((w) => VIEWPORTS[w]);
const langs = args.langs ? String(args.langs).split(",") : ["en", "es"];
const roles = args.roles ? String(args.roles).split(",") : ["none", "guest", "couple", "planner"];
const NEVER = /sign out|cerrar sesi|leave|salir de|delete|eliminar|send|enviar|remind|recordar|approve|aprobar|decline|rechazar/i;

if (!fs.existsSync(path.join(WEB_DIR, "index.html"))) {
  console.error("no web export found. Run: npx expo export -p web --output-dir .part9/web");
  process.exit(2);
}

// ------------------------------------------------ static server with SPA fallback
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".map": "application/json" };
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = path.join(WEB_DIR, clean);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_DIR, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${PORT}`;

// ------------------------------------------------ browser
const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ args: ["--disable-web-security"] });
const env = loadEnv();
const index = { started_at: new Date().toISOString(), base: BASE, shots: [], notes: [] };

async function newContext() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "en-US" });
  // Armed on the context before any page exists, so no click can race it.
  // route() throws if it cannot register, which aborts the run.
  await ctx.route("**/auth/v1/otp*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.route("**/auth/v1/magiclink*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  return ctx;
}

const tid = (page, id) => page.locator(`[data-testid="${id}"]`).first();

async function snap(page, role, lang, width, name) {
  const dir = path.join(OUT, role, lang, String(width));
  fs.mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  const n = String(index.shots.filter((s) => s.role === role && s.lang === lang && s.width === width).length + 1).padStart(2, "0");
  const file = path.join(dir, `${n}-${name}.png`);
  await page.screenshot({ path: file });
  index.shots.push({ role, lang, width, name, file: path.relative(ROOT, file), overflow_px: overflow, path: new URL(page.url()).pathname });
  if (overflow > 0) console.log(`  OVERFLOW ${overflow}px  ${role} ${lang} ${width} ${name}`);
}

/** React Native Web scrolls inside an inner element, so fullPage screenshots do not help. Scroll every scroller to its end. */
async function scrollBottom(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("div")) if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== "visible") el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(400);
}

async function setLang(page, lang) {
  // AsyncStorage on web is localStorage with the same keys. Reload at the root; the gate moves a signed-in user home.
  await page.evaluate((l) => window.localStorage.setItem("gl.lang", l), lang);
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
}

async function size(page, width) {
  await page.setViewportSize({ width, height: VIEWPORTS[width] });
  await page.waitForTimeout(500);
}

/**
 * Signed-in surfaces: resize, then reload at the root (the gate moves the user home). Without the
 * reload the draggable assistant bubble keeps the x position it took at the previous width and
 * hangs off the right edge, which reads as 16 px of horizontal overflow that no real device has.
 */
async function sizeSignedIn(page, width) {
  await size(page, width);
  await page.goto(`${BASE}/`);
  await tid(page, "tab-more").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

/** Clicks every navigating button of a More screen, captures the target, comes back. */
// Tabs are walked separately; the language toggle on guest More would flip the language mid-walk.
const MORE_BUTTONS = '[role="button"]:not([data-testid^="tab-"]):not([data-testid^="lang-"])';

/**
 * React Navigation on web keeps the other tab screens mounted, so their buttons (40 guest rows,
 * 24 RSVP rows) still count as visible to Playwright while being covered by the focused screen.
 * Clicking each one only to time out made the couple More walk crawl. A button is walked only
 * when a real pointer would reach it. The probe point is near the top left of the control so the
 * floating assistant bubble on the right never hides a tile from the test.
 */
async function hittable(b) {
  await b.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  return b
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const hit = document.elementFromPoint(r.left + Math.min(12, r.width / 2), r.top + Math.min(12, r.height / 2));
      return !!hit && (el === hit || el.contains(hit));
    })
    .catch(() => false);
}

async function walkMore(page, role, lang, width, moreTab) {
  const start = new URL(page.url()).pathname;
  const buttons = page.locator(MORE_BUTTONS);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const b = page.locator(MORE_BUTTONS).nth(i);
    const text = ((await b.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (NEVER.test(text)) {
      const note = `${role} ${lang}: never-click rule skipped "${text.slice(0, 40)}"`;
      if (!index.notes.includes(note)) index.notes.push(note);
      continue;
    }
    if (!(await b.isVisible().catch(() => false))) continue;
    if (!(await hittable(b))) continue;
    await b.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(1600);
    const now = new URL(page.url()).pathname;
    if (now === start) continue; // not a navigation (toggle, external link, disabled tile)
    await snap(page, role, lang, width, `more-${now.replace(/\W+/g, "_").replace(/^_|_$/g, "")}`);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(900);
    if (new URL(page.url()).pathname !== start) {
      await tid(page, moreTab).click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
  }
}

async function walkTabs(page, role, lang, width, tabs) {
  for (const t of tabs) {
    const tab = tid(page, `tab-${t}`);
    if (!(await tab.isVisible().catch(() => false))) {
      index.notes.push(`${role} ${lang} ${width}: tab-${t} is not visible`);
      continue;
    }
    await tab.click();
    await page.waitForTimeout(1800);
    await snap(page, role, lang, width, `tab-${t}`);
    if (t === "rsvp") {
      // The guest RSVP form: scrolled to its end, the submit is never clicked.
      await scrollBottom(page);
      await snap(page, role, lang, width, "tab-rsvp-bottom");
    }
    if (t === "more") await walkMore(page, role, lang, width, "tab-more");
  }
}

// ------------------------------------------------ signed out
async function runNone() {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  for (const lang of langs) {
    await setLang(page, lang);
    for (const width of widths) {
      await size(page, width);
      await page.goto(`${BASE}/`);
      await tid(page, "entrance-guest").waitFor({ timeout: 20000 });
      await snap(page, "none", lang, width, "entrance");
      await tid(page, "entrance-guest").click();
      await tid(page, "invite-open").waitFor({ timeout: 10000 });
      await snap(page, "none", lang, width, "invite");
      await tid(page, "topbar-back").click();
      await tid(page, "entrance-couple").waitFor({ timeout: 10000 });
      await tid(page, "entrance-couple").click();
      await tid(page, "signin-email").waitFor({ timeout: 10000 });
      await snap(page, "none", lang, width, "signin-link-mode");
      // Link-sent state: the OTP call is answered locally, no email exists.
      await tid(page, "signin-email").fill("part9-rig@test.guest-ly.com");
      await tid(page, "signin-submit").click();
      await page.waitForTimeout(1200);
      await scrollBottom(page);
      await snap(page, "none", lang, width, "signin-link-sent");
      await tid(page, "signin-use-password").click().catch(() => {});
      await tid(page, "signin-password").waitFor({ timeout: 5000 }).catch(() => index.notes.push(`none ${lang} ${width}: password mode did not open`));
      await scrollBottom(page);
      await snap(page, "none", lang, width, "signin-password-mode");
      await tid(page, "topbar-back").click().catch(() => {});
    }
  }
  await ctx.close();
}

// ------------------------------------------------ couple and planner
async function runUser(role) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const R = role === "planner" ? "PLANNER" : "COUPLE";
  await page.goto(`${BASE}/`);
  await tid(page, "entrance-couple").waitFor({ timeout: 20000 });
  await tid(page, "entrance-couple").click();
  await tid(page, "signin-email").fill(env.acc[`PART9_${R}_EMAIL`]);
  await tid(page, "signin-use-password").click();
  await tid(page, "signin-password").waitFor({ timeout: 5000 });
  await tid(page, "signin-password").fill(env.acc[`PART9_${R}_PASSWORD`]);
  await tid(page, "signin-submit").click();
  await tid(page, "tab-more").waitFor({ timeout: 30000 });
  const tabs = role === "planner" ? ["index", "guests", "requests", "budget", "more"] : ["index", "guests", "rsvps", "messages", "more"];
  for (const lang of langs) {
    await setLang(page, lang);
    await tid(page, "tab-more").waitFor({ timeout: 30000 });
    for (const width of widths) {
      await sizeSignedIn(page, width);
      await walkTabs(page, role, lang, width, tabs);
    }
  }
  await ctx.close();
}

// ------------------------------------------------ guest
async function runGuest() {
  const ctx = await newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await tid(page, "entrance-guest").waitFor({ timeout: 20000 });
  await tid(page, "entrance-guest").click();
  // The invite screen opens by itself when the sixth character lands (invite.tsx effect).
  // Clicking invite-open as well would call /auth/guest/open twice (10 a minute per IP).
  await tid(page, "invite-input").fill("CAMAND");
  await tid(page, "find-input").waitFor({ timeout: 20000 });
  await snap(page, "guest", "en", 390, "find-empty");
  await tid(page, "find-input").fill("Sof");
  await tid(page, "find-row-0").waitFor({ timeout: 20000 });
  await snap(page, "guest", "en", 390, "find-results");
  await tid(page, "find-row-0").click();
  // Native lands on /notify first. On web the notification step is skipped and the guest home opens directly.
  await Promise.race([tid(page, "notify-skip").waitFor({ timeout: 30000 }), tid(page, "tab-more").waitFor({ timeout: 30000 })]);
  if (await tid(page, "notify-skip").isVisible().catch(() => false)) {
    await snap(page, "guest", "en", 390, "notify");
    await tid(page, "notify-skip").click();
  } else index.notes.push("guest: /notify does not show on web (no notifications there); captured on the simulators instead");
  await tid(page, "tab-more").waitFor({ timeout: 30000 });
  for (const lang of langs) {
    await setLang(page, lang);
    await tid(page, "tab-more").waitFor({ timeout: 30000 });
    for (const width of widths) {
      await sizeSignedIn(page, width);
      await walkTabs(page, "guest", lang, width, ["index", "rsvp", "schedule", "concierge", "more"]);
    }
  }
  await ctx.close();
}

try {
  for (const role of roles) {
    console.log(`web rig: ${role}`);
    if (role === "none") await runNone();
    else if (role === "guest") await runGuest();
    else await runUser(role);
  }
} catch (err) {
  index.notes.push(`ABORTED: ${String(err.message).split("\n")[0]}`);
  console.error(`web rig stopped: ${String(err.message).split("\n")[0]}`);
  process.exitCode = 1;
} finally {
  index.finished_at = new Date().toISOString();
  writeJson(path.join(OUT, "index.json"), index);
  const over = index.shots.filter((s) => s.overflow_px > 0);
  console.log(`web rig: ${index.shots.length} screenshots, ${over.length} with horizontal overflow, ${index.notes.length} notes. ${path.relative(ROOT, OUT)}/index.json`);
  await browser.close();
  server.close();
}
