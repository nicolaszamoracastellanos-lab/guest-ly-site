// The one HTTP client. Every request goes to {API_BASE}/api/mobile/v1 with
// the right credential header, the language, platform and app version. The
// app never talks to Supabase tables; only supabase.auth for the JWT.
//
// Couple and planner tokens: the session registers a token source
// (setTokenSource). Each request asks it for the current access token, which
// auth-js refreshes when it has expired, so coming back to the app after an
// hour never sends a dead JWT. A 401 on a user request refreshes once and
// retries before the session is declared gone (review P1-6).

import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as SecureStore from "@/lib/secure";

export const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://app.guest-ly.com";

export type ApiError = { code: string; message_en: string; message_es: string };

// The app's own sentence for codes whose wording or behaviour it owns, in the
// informal tú register (older portal builds answered in usted), and for
// answers that carry no envelope at all (the host's 413 page).
const LOCAL: Record<string, { en: string; es: string }> = {
  unauthorized: { en: "Please sign in again.", es: "Vuelve a iniciar sesión." },
  rate_limited: { en: "Too many tries. Please wait a minute and try again.", es: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." },
  update_required: { en: "Please update Guest-ly to continue.", es: "Actualiza Guest-ly para continuar." },
  tenant_unavailable: { en: "That wedding is no longer available on this account. We opened your other wedding.", es: "Esa boda ya no está disponible en esta cuenta. Abrimos tu otra boda." },
  tenant_required: { en: "Choose a wedding to continue.", es: "Elige una boda para continuar." },
  payload_too_large: { en: "That file is too large. Use one under 4 MB.", es: "Ese archivo es demasiado grande. Usa uno de menos de 4 MB." },
  http_413: { en: "That file is too large. Use one under 4 MB.", es: "Ese archivo es demasiado grande. Usa uno de menos de 4 MB." },
  send_in_progress: { en: "This send is already on its way. Check History in a moment before sending again.", es: "Este envío ya está en curso. Revisa el historial en un momento antes de volver a enviar." },
  method_not_allowed: { en: "Something went wrong. Please try again.", es: "Algo salió mal. Inténtalo de nuevo." },
  pending_db: { en: "This part is being set up. Please try again later.", es: "Esta parte se está configurando. Inténtalo de nuevo más tarde." },
  server_error: { en: "Something went wrong. Please try again.", es: "Algo salió mal. Inténtalo de nuevo." },
  invalid_code: { en: "That code did not open a wedding. Check it and try again.", es: "Ese código no abrió ninguna boda. Revísalo e inténtalo de nuevo." },
  too_many_matches: { en: "Several names match. Add one more letter.", es: "Varios nombres coinciden. Agrega una letra más." },
  engine_unavailable: { en: "The concierge is taking a moment. Please try again.", es: "El concierge necesita un momento. Inténtalo de nuevo." },
  not_live: { en: "This wedding is not open yet.", es: "Esta boda todavía no está abierta." },
};
/** A planner tool that is switched off: the server's sentence names it, so it
 *  is kept unless it is the old generic one. */
const FORBIDDEN_GENERIC = { en: "Your role does not allow this action.", es: "Tu rol no permite esta acción." };
const USTED = /\b(Su rol|inténtelo|Inténtelo|Por favor inicie|actualice|Espere|Revíselo|Agregue)\b/;

export class ApiFailure extends Error {
  code: string;
  status: number;
  /** A finer cause some routes send (RSVP: missing_answers, ...). */
  reason: string | null;
  messages: { en: string; es: string };
  constructor(status: number, err: (ApiError & { reason?: string }) | null) {
    super(err?.code ?? `http_${status}`);
    this.status = status;
    this.code = err?.code ?? `http_${status}`;
    this.reason = typeof err?.reason === "string" ? err.reason : null;
    const local = LOCAL[this.code];
    if (local) this.messages = { ...local };
    else if (this.code === "forbidden" && (!err?.message_es || USTED.test(err.message_es))) this.messages = { ...FORBIDDEN_GENERIC };
    else
      this.messages = {
        en: err?.message_en ?? "Something went wrong. Please try again.",
        es: err?.message_es && !USTED.test(err.message_es) ? err.message_es : "Algo salió mal. Inténtalo de nuevo.",
      };
  }
}

export type Credential =
  | { kind: "guest"; token: string }
  | { kind: "user"; jwt: string; tenantSlug?: string | null }
  | { kind: "none" };

/** Where the session gets a live couple or planner token. */
export type TokenSource = {
  /** The current access token (refreshed by auth-js when expired), or null. */
  current: () => Promise<string | null>;
  /** Forces a refresh; the new token, or null when the session is gone. */
  refresh: () => Promise<string | null>;
};

let credential: Credential = { kind: "none" };
let language: "en" | "es" = "en";
let onUnauthorized: ((kind: "guest" | "user") => void) | null = null;
let onUpdateRequired: (() => void) | null = null;
let onTenantUnavailable: (() => void) | null = null;
let tokenSource: TokenSource | null = null;

export function setCredential(c: Credential) {
  credential = c;
}
export function getCredential(): Credential {
  return credential;
}
export function setApiLanguage(lang: "en" | "es") {
  language = lang;
}
export function setAuthHandlers(h: { unauthorized?: (kind: "guest" | "user") => void; update?: () => void; tenantUnavailable?: () => void }) {
  onUnauthorized = h.unauthorized ?? null;
  onUpdateRequired = h.update ?? null;
  onTenantUnavailable = h.tenantUnavailable ?? null;
}
export function setTokenSource(s: TokenSource | null) {
  tokenSource = s;
}

export const APP_VERSION = Application.nativeApplicationVersion ?? "1.0.0";

// A random install id (never tied to a person), sent as x-gl-device so the
// portal's per-client rate limits count this phone, not the whole venue
// Wi-Fi it shares with 150 other guests. Loaded once; requests made before
// it is read simply go without it.
const K_DEVICE = "gl.device";
let deviceId: string | null = null;
const deviceReady = (async () => {
  try {
    const saved = await SecureStore.getItemAsync(K_DEVICE);
    if (saved && /^[A-Za-z0-9._:-]{8,128}$/.test(saved)) {
      deviceId = saved;
      return;
    }
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(K_DEVICE, fresh);
    deviceId = fresh;
  } catch {
    // no id: the portal falls back to the IP alone
  }
})();

/** Default abort for ordinary reads and writes. */
const DEFAULT_TIMEOUT_MS = 20_000;
/** Calls that upload a file or run a model on the server. Matched by path so
 *  every caller gets it, including feature hooks that pass no timeout
 *  (review P1-17: budget AI import aborted at 20 s and read as "offline"). */
const LONG_TIMEOUT_MS = 120_000;
const LONG_PATHS = /\/(import\/(extract|commit|parse)|seating\/(analyze|upload|auto-assign)|website\/image|brain\/(publish|preview)|guest\/concierge$|exports\/)/;

function headers(c: Credential, jwt: string | null, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-gl-lang": language,
    "x-gl-platform": Platform.OS === "android" ? "android" : "ios",
    "x-gl-app-version": APP_VERSION,
    ...(deviceId ? { "x-gl-device": deviceId } : {}),
    ...(extra ?? {}),
  };
  if (c.kind === "guest") h.Authorization = `Guest ${c.token}`;
  if (c.kind === "user") {
    h.Authorization = `Bearer ${jwt ?? c.jwt}`;
    if (c.tenantSlug) h["x-gl-tenant"] = c.tenantSlug;
  }
  return h;
}

type Method = "GET" | "POST" | "DELETE" | "PATCH" | "PUT";

export type ApiOptions = {
  method?: Method;
  body?: unknown;
  timeoutMs?: number;
  /** Extra headers (Idempotency-Key and similar). */
  headers?: Record<string, string>;
  /** Use this credential instead of the session's, as given (no token
   *  refresh, no global 401 handling). The session uses it to try a wedding
   *  before committing to it. */
  credential?: Credential;
  /** False: a 401 is the caller's to handle; no refresh, no sign out. */
  handleAuth?: boolean;
};

async function once(path: string, opts: ApiOptions, c: Credential, jwt: string | null): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? (LONG_PATHS.test(path) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(`${API_BASE}/api/mobile/v1${path}`, {
      method: opts.method ?? "GET",
      headers: headers(c, jwt, opts.headers),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch {
    // Status 0 either way: the request may or may not have reached the
    // server, so queues keep the entry and idempotent replays stay safe.
    if (timedOut) {
      throw new ApiFailure(0, {
        code: "timeout",
        message_en: "This is taking longer than usual. Please try again in a moment.",
        message_es: "Esto está tardando más de lo normal. Inténtalo de nuevo en un momento.",
      });
    }
    throw new ApiFailure(0, {
      code: "offline",
      message_en: "You seem to be offline. We will retry when the connection is back.",
      message_es: "Parece que no tienes conexión. Reintentaremos cuando vuelva.",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function liveToken(): Promise<string | null> {
  if (!tokenSource) return null;
  try {
    return await tokenSource.current();
  } catch {
    return null;
  }
}

/**
 * The headers api() sends, for the few requests it does not make itself (the
 * guest export download, the Coordinator's event stream): the live couple or
 * planner token (auth-js refreshes it when expired, so an hour in the
 * background never sends a dead JWT), or the guest token, plus tenant,
 * device, platform, app version and language. `extra` overrides any of them
 * (Accept, x-gl-lang). A 401 or 426 on such a request still goes through
 * relayAuthStatus (features/shared/requests) to end the session or show the
 * update screen.
 */
export async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  if (!deviceId) await deviceReady;
  const c = credential;
  const jwt = c.kind === "user" ? await liveToken() : null;
  return headers(c, jwt, extra);
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!deviceId) await deviceReady;
  const explicit = opts.credential;
  const c = explicit ?? credential;
  const managed = !explicit && opts.handleAuth !== false;
  let jwt = c.kind === "user" && !explicit ? await liveToken() : null;
  let res = await once(path, opts, c, jwt);

  if (res.status === 401 && managed && c.kind === "user" && tokenSource) {
    // An expired token that auth-js had not refreshed yet: refresh once, retry.
    const fresh = await tokenSource.refresh().catch(() => null);
    if (fresh && fresh !== jwt) {
      jwt = fresh;
      res = await once(path, opts, c, jwt);
    }
  }

  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: ApiError }
    | null;
  // Only a request made with the credential the session still holds may end
  // that session: a late 401 from the account just signed out must not. A
  // guest is signed out only by a guest route: a 401 from a couple or planner
  // route (a guest who somehow reached a couple screen) is that screen's
  // error, never the end of the guest's invitation.
  const endsSession = c.kind === "user" || (c.kind === "guest" && /^\/(guest|auth\/guest)\//.test(path));
  if (res.status === 401 && managed && endsSession && c === credential) onUnauthorized?.(c.kind as "guest" | "user");
  if (res.status === 426) onUpdateRequired?.();
  if (!res.ok || !json || json.ok === false) {
    const failure = new ApiFailure(res.status, json && json.ok === false ? json.error : null);
    // The saved wedding was removed from this account: the session forgets
    // it and reopens on the account's current wedding.
    if (failure.code === "tenant_unavailable" && managed && c.kind === "user" && c === credential) onTenantUnavailable?.();
    throw failure;
  }
  return json.data;
}

export const get = <T>(path: string, opts?: Omit<ApiOptions, "method" | "body">) => api<T>(path, opts);
export const post = <T>(path: string, body?: unknown, opts?: Omit<ApiOptions, "method" | "body">) => api<T>(path, { ...opts, method: "POST", body });
export const del = <T>(path: string, body?: unknown, opts?: Omit<ApiOptions, "method" | "body">) => api<T>(path, { ...opts, method: "DELETE", body });
