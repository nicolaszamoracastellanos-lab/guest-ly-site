// Renders the Guest-ly App Store set: node render.mjs [en|es|all] [--only 03-concierge]
// Output: ../ios-6.9/{en-US,es-MX}/<SET>/NN-name.png (SET defaults to v3), 1320 x 2868, sRGB, no alpha.
import { createRequire } from "module";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = [HERE, process.env.PLAYWRIGHT_FROM, path.join(process.env.HOME, "Desktop/guest-ly/guestly-portal-deploy")].filter(Boolean);
  for (const t of tries) {
    try { return createRequire(path.join(t, "package.json"))("playwright"); } catch {}
  }
  throw new Error("playwright not found: run `npm i` in this folder or set PLAYWRIGHT_FROM to a project that has it");
}
const { chromium } = loadPlaywright();

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith("--")) ?? "all";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const langs = which === "all" ? ["en", "es"] : [which];
const OUT = { en: "en-US", es: "es-MX" };
const SET = process.env.SET ?? "v3";

const browser = await chromium.launch();
for (const lang of langs) {
  const url = `file://${path.join(HERE, "index.html")}?lang=${lang}`;
  const page = await browser.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 60000 });
  const ids = await page.$$eval(".panel", (els) => els.map((e) => e.dataset.id));
  // Overflow guard: the copy block must end above the first phone.
  const clash = await page.$$eval(".panel", (els) => els.map((p) => {
    const c = p.querySelector(".copy").getBoundingClientRect();
    const tops = [...p.querySelectorAll(".device")].map((d) => d.getBoundingClientRect().top);
    return { id: p.dataset.id, copyBottom: Math.round(c.bottom), deviceTop: Math.round(Math.min(...tops)) };
  }));
  for (const c of clash) if (c.copyBottom > c.deviceTop - 20) console.warn(`  ! ${lang} ${c.id}: copy ends at ${c.copyBottom}, phone starts at ${c.deviceTop}`);
  await page.setViewportSize({ width: 1320 * ids.length, height: 2868 });
  await page.waitForTimeout(400);
  const dir = path.join(HERE, "..", "ios-6.9", OUT[lang], SET);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < ids.length; i++) {
    if (only && ids[i] !== only) continue; // always lay out the full strip so backdrops line up
    const file = path.join(dir, `${ids[i]}.png`);
    await page.screenshot({ path: file, clip: { x: i * 1320, y: 0, width: 1320, height: 2868 } });
    files.push(file);
  }
  // App Store Connect rejects screenshots with an alpha channel: flatten to RGB.
  execFileSync("python3", ["-c", "import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n  Image.open(f).convert('RGB').save(f, optimize=True)", ...files]);
  console.log(lang, files.length, "panels ->", dir);
  await page.close();
}
await browser.close();
