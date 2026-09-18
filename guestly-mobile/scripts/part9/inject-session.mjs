// Session and language injection for the Part 9 audit.
//
//   node scripts/part9/inject-session.mjs --udid S --role couple --lang es
//
//   --udid   device letter (S M L T P) or a raw UDID
//   --role   couple | planner | guest | none | keep
//            keep = change only the language, leave the session files alone
//   --lang   en | es (written as the explicit app choice, key gl.lang)
//   --no-launch   only write the files, do not start the app
//   --no-prep     guest only: skip the Maestro prep flow before the invite link
//   --settle <s>  seconds to wait after launch before returning (default 14 dev, 6 release)
//
// How it works: the app persists the Supabase session and the language in
// AsyncStorage, which on iOS is a folder of plain files inside the app
// container (manifest.json plus one file per value over 1024 bytes, named by
// the MD5 of the key). With the app terminated we write those files, so the
// next launch restores a signed-in demo user with no password ever typed
// into a UI. Guests use the product's own deep link /i/CODE?g=<guestId>.
//
// Rules (plan sections 5 and 7.6):
//   one password grant per simulator and role; a session is never copied to
//   a second simulator (Supabase rotates refresh tokens and revokes the
//   family on reuse). Use --role keep for a language change.
//   No token or password is ever printed or written outside the simulator.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BUNDLE_ID, INVITE_CODE, PART9, launchApp, loadEnv, maestro, openRoute, parseArgs, passwordGrant, readJson, simctl, sleep, trySimctl, udidOf } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const udid = udidOf(args.udid ?? "");
const role = String(args.role ?? "keep");
const lang = args.lang === "es" ? "es" : args.lang === "en" ? "en" : null;
if (!udid || !["couple", "planner", "guest", "none", "keep"].includes(role) || !lang) {
  console.error("usage: inject-session.mjs --udid <S|M|L|T|P|udid> --role couple|planner|guest|none|keep --lang en|es [--no-launch] [--settle seconds]");
  process.exit(2);
}
const release = (process.env.GL_BINARY ?? "dev") === "release";
const settle = Number(args.settle ?? (release ? 6 : 14)) * 1000;

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

function storageDir() {
  const data = simctl(["get_app_container", udid, BUNDLE_ID, "data"]).trim();
  return path.join(data, "Library", "Application Support", BUNDLE_ID, "RCTAsyncLocalStorage_V1");
}

function removeKey(dir, manifest, key) {
  delete manifest[key];
  fs.rmSync(path.join(dir, md5(key)), { force: true });
}

function setKey(dir, manifest, key, value) {
  // Same rule as RNCAsyncStorage.mm: up to 1024 bytes inline, else a file.
  if (Buffer.byteLength(value, "utf8") <= 1024) {
    fs.rmSync(path.join(dir, md5(key)), { force: true });
    manifest[key] = value;
  } else {
    fs.writeFileSync(path.join(dir, md5(key)), value, { mode: 0o600 });
    manifest[key] = null;
  }
}

async function main() {
  trySimctl(["terminate", udid, BUNDLE_ID]);
  await sleep(800);
  const dir = storageDir();
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = readJson(manifestPath, {});
  const env = loadEnv();
  const sbKey = `sb-${env.ref}-auth-token`;

  // Language is always explicit, and no stale-language payload survives.
  setKey(dir, manifest, "gl.lang", lang);
  removeKey(dir, manifest, "gl.query.cache");

  if (role === "couple" || role === "planner") {
    const s = await passwordGrant(role);
    const session = {
      access_token: s.access_token,
      token_type: s.token_type ?? "bearer",
      expires_in: s.expires_in,
      expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + Number(s.expires_in ?? 3600),
      refresh_token: s.refresh_token,
      user: s.user,
    };
    setKey(dir, manifest, sbKey, JSON.stringify(session));
    // A guest record in AsyncStorage would win at boot (session.tsx); drop it.
    removeKey(dir, manifest, "gl.guest.meta");
    removeKey(dir, manifest, "gl.tenant");
  } else if (role === "guest" || role === "none") {
    removeKey(dir, manifest, sbKey);
    removeKey(dir, manifest, `${sbKey}-code-verifier`);
    removeKey(dir, manifest, "gl.tenant");
    removeKey(dir, manifest, "gl.guest.meta");
    removeKey(dir, manifest, "gl.biometric");
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  if (args["no-launch"]) {
    console.log(`injected role=${role} lang=${lang} on ${udid} (not launched)`);
    return;
  }

  launchApp(udid);
  await sleep(settle);

  if (role === "guest") {
    const ids = readJson(path.join(PART9, "ids.json"), {});
    const guestId = ids?.guest?.self_guest_id;
    if (!guestId) throw new Error("no guest id: run resolve-ids.mjs first (it writes .part9/ids.json)");
    // On a fresh simulator the first guestly:// link raises the system sheet
    // "Open in Guest-ly?" and nothing reaches the app until it is accepted
    // (seen on the iPad: 14 captures of the sheet). Open the harmless entrance
    // link first and let the prep flow accept the sheet.
    if (!args["no-prep"]) {
      openRoute(udid, "/");
      await sleep(2500);
      maestro(udid, "prep.yaml");
      await sleep(1000);
    }
    // The product's own deep link mints the guest session, then lands on /notify.
    openRoute(udid, `/i/${INVITE_CODE}?g=${guestId}`);
    await sleep(release ? 5000 : 7000);
    // Skip the notification pre-prompt without tapping.
    openRoute(udid, "/guest");
    await sleep(3000);
  }
  console.log(`injected role=${role} lang=${lang} on ${udid} and launched`);
}

main().catch((err) => {
  console.error(`inject-session failed: ${err.message}`);
  process.exit(1);
});
