// Crash and error reporting without a third-party service (review P1-11).
//
// Reports go to POST {API_BASE}/api/mobile/v1/telemetry, a rate-limited portal
// route that stores them in `mobile_telemetry`. No personal data leaves the
// phone: no credential, no user or guest id, no email or phone (scrubbed from
// messages and stacks), and the route has its ids masked.
//
// Sources:
//   - the error boundaries (a render threw; the branded recovery screen shows)
//   - the global JS handler (a throw in a press handler or a timer; fatal ones
//     are written to disk first and sent on the next launch)
//   - unhandled promise rejections (release builds only; dev keeps LogBox)
//   - reportError(err) from any catch that wants a record

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { API_BASE, APP_VERSION } from "@/lib/api";

export type ReportKind = "boundary" | "fatal" | "handled" | "unhandled_rejection";

type Report = {
  kind: ReportKind;
  name: string;
  message: string;
  stack: string;
  route: string;
  fingerprint: string;
  app_version: string;
  runtime_version: string;
  os_version: string;
  at: string;
};

const PENDING_KEY = "gl.telemetry.pending";
const ENDPOINT = `${API_BASE}/api/mobile/v1/telemetry`;
const MAX_PER_SESSION = 20;
const MAX_PENDING = 10;

let route = "";
let sentThisSession = 0;
const seen = new Set<string>();

/** The root layout keeps this current so a report says where it happened. */
export function setTelemetryRoute(pathname: string) {
  route = maskRoute(pathname);
}

export function maskRoute(p: string): string {
  return p
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/[A-Za-z0-9_-]{16,}/g, "/:id")
    .slice(0, 200);
}

/** Removes anything that could identify a person or unlock an account. */
export function scrub(s: string): string {
  return s
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token]")
    .replace(/(Bearer|Guest)\s+[A-Za-z0-9._~+/=-]{12,}/g, "$1 [token]")
    .replace(/ExponentPushToken\[[^\]]+\]/g, "[push-token]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]");
}

function hash(s: string): string {
  // FNV-1a, 32 bit: a stable fingerprint to group repeats; not security.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function runtimeVersion(): string {
  const c = Constants as unknown as { expoConfig?: { runtimeVersion?: unknown }; manifest2?: { runtimeVersion?: unknown } };
  const v = c.manifest2?.runtimeVersion ?? c.expoConfig?.runtimeVersion;
  return typeof v === "string" ? v.slice(0, 80) : "";
}

function build(error: unknown, kind: ReportKind): Report {
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-error thrown");
  const name = (e.name || "Error").slice(0, 80);
  const message = scrub(String(e.message || "")).slice(0, 500);
  const stack = scrub(String(e.stack || "")).slice(0, 4000);
  // Group by type, message and the first frames, never by volatile numbers.
  const top = stack.split("\n").slice(0, 4).join("\n").replace(/:\d+:\d+/g, "");
  return {
    kind,
    name,
    message,
    stack,
    route,
    fingerprint: hash(`${name}|${message.replace(/\d+/g, "#")}|${top}`),
    app_version: APP_VERSION,
    runtime_version: runtimeVersion(),
    os_version: String(Platform.Version ?? "").slice(0, 40),
    at: new Date().toISOString(),
  };
}

async function post(reports: Report[]): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-gl-platform": Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios",
        "x-gl-app-version": APP_VERSION,
      },
      body: JSON.stringify({ reports }),
      signal: controller.signal,
    });
    // 404 before the route is deployed, 429 when limited: drop, never retry forever.
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function savePending(r: Report) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as Report[]) : [];
    list.push(r);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-MAX_PENDING)));
  } catch {
    // nothing else to do
  }
}

/** Sends what a crash left on disk. Called once at launch. */
export async function flushPendingReports() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as Report[];
    if (!Array.isArray(list) || !list.length) return void AsyncStorage.removeItem(PENDING_KEY);
    if (await post(list.slice(-MAX_PENDING))) await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // try again next launch
  }
}

/** Records an error. Never throws; dedupes repeats within one run. */
export function reportError(error: unknown, kind: ReportKind = "handled"): Promise<void> {
  try {
    if (__DEV__ && process.env.EXPO_PUBLIC_TELEMETRY_DEV !== "1") return Promise.resolve();
    const r = build(error, kind);
    const key = `${r.kind}:${r.fingerprint}`;
    if (seen.has(key) || sentThisSession >= MAX_PER_SESSION) return Promise.resolve();
    seen.add(key);
    sentThisSession += 1;
    // A fatal error kills the process before a request can finish: write it
    // down first, send it now if there is time, and flush it next launch.
    if (kind === "fatal") {
      return savePending(r).then(async () => {
        if (await post([r])) await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      });
    }
    return post([r]).then(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
let installed = false;

/** Wraps React Native's global handler (once). The previous handler still
 *  runs, so development keeps the red box and release keeps its behaviour. */
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };
    HermesInternal?: { enablePromiseRejectionTracker?: (o: { allRejections: boolean; onUnhandled: (id: number, err: unknown) => void; onHandled?: (id: number) => void }) => void };
  };
  const utils = g.ErrorUtils;
  if (utils) {
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      if (!isFatal) {
        void reportError(error, "handled");
        previous?.(error, isFatal);
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        previous?.(error, isFatal);
      };
      void reportError(error, "fatal").finally(finish);
      setTimeout(finish, 1_500);
    });
  }
  if (!__DEV__) {
    g.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, err) => void reportError(err, "unhandled_rejection"),
    });
  }
}
