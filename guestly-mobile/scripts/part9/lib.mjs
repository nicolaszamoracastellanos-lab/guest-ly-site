// Shared helpers for the Part 9 harness scripts. Node built-ins only.
//
// Secret rules: nothing here prints, logs or writes a password, an access
// token or a refresh token. On failure callers print the HTTP status only.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../..");
export const PART9 = path.join(ROOT, ".part9");
export const BUNDLE_ID = "com.zcventures.guestly";
export const DEMO_TENANT = "demo-review";
export const INVITE_CODE = "CAMAND";

export const DEVICES = {
  S: "B9898E62-D4D4-452A-B4B0-460D4A016ED2",
  M: "30398ECB-3A6B-4A34-BC77-B9FB8B4EF25F",
  L: "615D5183-56C3-4184-BC78-0FAB711D9A50",
  T: "B1D6BA49-2379-4886-BA9B-3A3FB4C71897",
  P: "F5F84E6A-4E3B-4417-A413-368E0A5BAC81",
};

export function udidOf(dev) {
  return DEVICES[String(dev).toUpperCase()] ?? dev;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Public app env (.env) plus the gitignored demo accounts file. */
export function loadEnv() {
  const pub = parseEnvFile(path.join(ROOT, ".env"));
  const acc = parseEnvFile(path.join(ROOT, "credentials", "demo-accounts.env"));
  const supabaseUrl = pub.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = pub.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("guestly-mobile/.env is missing the public Supabase values");
  // The harness scripts always talk to the live API directly, never through the state proxy.
  const apiBase = "https://app.guest-ly.com";
  const ref = new URL(supabaseUrl).host.split(".")[0];
  return { supabaseUrl, anonKey, apiBase, ref, acc };
}

/** Password grant for a demo role. Returns the raw session JSON. Never log it. */
export async function passwordGrant(role) {
  const env = loadEnv();
  const R = role === "planner" ? "PLANNER" : "COUPLE";
  const email = env.acc[`PART9_${R}_EMAIL`];
  const password = env.acc[`PART9_${R}_PASSWORD`];
  if (!email || !password) throw new Error("credentials/demo-accounts.env is missing or incomplete (see docs/PART9-HARNESS.md)");
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`password grant for ${role} failed with HTTP ${res.status}`);
  return res.json();
}

/** Mobile API client bound to one credential. Throws on non-demo tenants before any write. */
export function apiClient({ bearer, guestToken, lang = "en" }) {
  const env = loadEnv();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-gl-lang": lang,
    "x-gl-platform": "ios",
    "x-gl-app-version": "1.0.0",
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (guestToken) headers.Authorization = `Guest ${guestToken}`;
  async function call(method, p, body) {
    const res = await fetch(`${env.apiBase}/api/mobile/v1${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok && !!json && json.ok === true, data: json && json.ok ? json.data : null, error: json && json.ok === false ? json.error : null };
  }
  return {
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b ?? {}),
    del: (p, b) => call("DELETE", p, b),
  };
}

/** Aborts unless /auth/me says this session is on the demo tenant. */
export async function assertDemoTenant(client) {
  const me = await client.get("/auth/me");
  if (!me.ok) throw new Error(`/auth/me answered HTTP ${me.status}`);
  if (me.data?.tenant?.slug !== DEMO_TENANT) throw new Error(`tenant fence: expected ${DEMO_TENANT}, refusing to continue`);
  return me.data;
}

export function simctl(args, opts = {}) {
  return execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

export function trySimctl(args) {
  try {
    return simctl(args);
  } catch {
    return null;
  }
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

/** Dev client URL that loads the bundle from the local Metro. */
export function devClientUrl(port = process.env.GL_METRO_PORT ?? "8097") {
  return `exp+guestly://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${port}`)}`;
}

/** Terminate and start the app: dev client loads from Metro, release just launches. */
export function launchApp(udid) {
  trySimctl(["terminate", udid, BUNDLE_ID]);
  if ((process.env.GL_BINARY ?? "dev") === "release") simctl(["launch", udid, BUNDLE_ID]);
  else simctl(["openurl", udid, devClientUrl()]);
}

export function openRoute(udid, route) {
  simctl(["openurl", udid, `guestly://${route}`]);
}

/**
 * Runs one Maestro flow from .maestro/ against a simulator. Returns true when the flow passed.
 * Maestro 2.10 only lets takeScreenshot write inside the run's own output folder, so flows take
 * a relative NAME and this helper moves the PNGs to opts.shotsTo afterwards. The rest of the run
 * folder (logs, commands.json) is deleted. Never use shotsTo for a flow that types a password:
 * those runs go to ~/.maestro/tests and are deleted by the caller (plan C7).
 */
export function maestro(udid, flow, env = {}, opts = {}) {
  const home = process.env.HOME ?? "";
  const javaHome = "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home";
  const e = { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${home}/.maestro/bin:${process.env.PATH}`, MAESTRO_CLI_NO_ANALYTICS: "1" };
  const argv = ["--device", udid, "test"];
  const runDir = opts.shotsTo ? fs.mkdtempSync(path.join(PART9, "maestro-run-")) : null;
  if (runDir) argv.push("--test-output-dir", runDir);
  for (const [k, v] of Object.entries(env)) argv.push("-e", `${k}=${v}`);
  argv.push(path.join(ROOT, ".maestro", flow));
  const r = spawnSync("maestro", argv, { env: e, cwd: ROOT, encoding: "utf8" });
  if (runDir) {
    fs.mkdirSync(opts.shotsTo, { recursive: true });
    const stack = [runDir];
    while (stack.length) {
      const d = stack.pop();
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) stack.push(full);
        else if (ent.name.endsWith(".png") && path.basename(d) === "takeScreenshot") fs.renameSync(full, path.join(opts.shotsTo, ent.name));
      }
    }
    fs.rmSync(runDir, { recursive: true, force: true });
  } else {
    // Default run folders hold the resolved text of every inputText. Never keep them.
    fs.rmSync(path.join(home, ".maestro", "tests"), { recursive: true, force: true });
  }
  if (opts.verbose && r.status !== 0) console.error((r.stdout ?? "").split("\n").filter((l) => /FAILED|Assertion|Invalid/.test(l)).slice(0, 6).join("\n"));
  return r.status === 0;
}
