// The one HTTP client. Every request goes to {API_BASE}/api/mobile/v1 with
// the right credential header, the language, platform and app version. The
// app never talks to Supabase tables; only supabase.auth for the JWT.

import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Application from "expo-application";

export const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://app.guest-ly.com";

export type ApiError = { code: string; message_en: string; message_es: string };

export class ApiFailure extends Error {
  code: string;
  status: number;
  messages: { en: string; es: string };
  constructor(status: number, err: ApiError | null) {
    super(err?.code ?? `http_${status}`);
    this.status = status;
    this.code = err?.code ?? `http_${status}`;
    this.messages = {
      en: err?.message_en ?? "Something went wrong. Please try again.",
      es: err?.message_es ?? "Algo salió mal. Inténtelo de nuevo.",
    };
  }
}

export type Credential =
  | { kind: "guest"; token: string }
  | { kind: "user"; jwt: string; tenantSlug?: string | null }
  | { kind: "none" };

let credential: Credential = { kind: "none" };
let language: "en" | "es" = "en";
let onUnauthorized: (() => void) | null = null;
let onUpdateRequired: (() => void) | null = null;

export function setCredential(c: Credential) {
  credential = c;
}
export function getCredential(): Credential {
  return credential;
}
export function setApiLanguage(lang: "en" | "es") {
  language = lang;
}
export function setAuthHandlers(h: { unauthorized?: () => void; update?: () => void }) {
  onUnauthorized = h.unauthorized ?? null;
  onUpdateRequired = h.update ?? null;
}

export const APP_VERSION = Application.nativeApplicationVersion ?? "1.0.0";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-gl-lang": language,
    "x-gl-platform": Platform.OS === "android" ? "android" : "ios",
    "x-gl-app-version": APP_VERSION,
  };
  if (credential.kind === "guest") h.Authorization = `Guest ${credential.token}`;
  if (credential.kind === "user") {
    h.Authorization = `Bearer ${credential.jwt}`;
    if (credential.tenantSlug) h["x-gl-tenant"] = credential.tenantSlug;
  }
  return h;
}

type Method = "GET" | "POST" | "DELETE";

export async function api<T>(
  path: string,
  opts: { method?: Method; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/mobile/v1${path}`, {
      method: opts.method ?? "GET",
      headers: headers(),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiFailure(0, {
      code: "offline",
      message_en: "You seem to be offline. We will retry when the connection is back.",
      message_es: "Parece que no tiene conexión. Reintentaremos cuando vuelva.",
    });
  }
  clearTimeout(timer);
  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: ApiError }
    | null;
  if (res.status === 401) onUnauthorized?.();
  if (res.status === 426) onUpdateRequired?.();
  if (!res.ok || !json || json.ok === false) {
    throw new ApiFailure(res.status, json && json.ok === false ? json.error : null);
  }
  return json.data;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: "DELETE", body });
