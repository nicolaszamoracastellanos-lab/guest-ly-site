// Contact sheets: several screenshots side by side, each labelled with its
// route id, so a whole walk can be read in a few images (plan C11).
//
//   node scripts/part9/sheet.mjs --dir .part9/shots/L/es/planner [--per 4] [--width 1800]
//
// Reads <dir>/jpg/*.jpg (written by walk.mjs), writes <dir>/sheets/sheet-NN.jpg.
// Rule: S-EN and S-ES are read one image at a time; sheets are for L, T, P, M
// and regression walks. Open the single image for anything that looks off.
//
// Playwright comes from the portal's node_modules by absolute path (read-only
// use; this app installs no second copy). Tracing, video and HAR stay off.

import fs from "node:fs";
import path from "node:path";
import { ROOT, parseArgs } from "./lib.mjs";

const PLAYWRIGHT = "/Users/nicolas_z/Desktop/guest-ly/guestly-portal/node_modules/playwright/index.mjs";
const args = parseArgs(process.argv.slice(2));
const dir = path.resolve(ROOT, String(args.dir ?? ""));
const per = Number(args.per ?? 4);
const width = Number(args.width ?? 1800);
const jpgDir = path.join(dir, "jpg");
if (!args.dir || !fs.existsSync(jpgDir)) {
  console.error("usage: sheet.mjs --dir <walk output folder that has a jpg/ sub folder> [--per 4] [--width 1800]");
  process.exit(2);
}

const files = fs.readdirSync(jpgDir).filter((f) => f.endsWith(".jpg")).sort();
const outDir = path.join(dir, "sheets");
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 1 });
let n = 0;
for (let i = 0; i < files.length; i += per) {
  const group = files.slice(i, i + per);
  const cells = group
    .map((f) => {
      const b64 = fs.readFileSync(path.join(jpgDir, f)).toString("base64");
      return `<figure><figcaption>${f.replace(/\.jpg$/, "")}</figcaption><img src="data:image/jpeg;base64,${b64}"></figure>`;
    })
    .join("");
  await page.setContent(`<html><body style="margin:0;background:#15181d;font:600 20px -apple-system,Helvetica,sans-serif;color:#f7f3ec"><div style="display:grid;grid-template-columns:repeat(${per},1fr);gap:14px;padding:14px">${cells}</div><style>figure{margin:0}figcaption{padding:6px 2px 8px;word-break:break-all}img{width:100%;display:block;border:1px solid #3a3f47}</style></body></html>`);
  await page.waitForLoadState("load");
  n += 1;
  const out = path.join(outDir, `sheet-${String(n).padStart(2, "0")}.jpg`);
  await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 82 });
  console.log(path.relative(ROOT, out), group.map((f) => f.split("-")[0]).join(" "));
}
await browser.close();
