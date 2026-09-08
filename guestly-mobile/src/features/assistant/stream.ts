// Streaming client for the Coordinator routes. React Native's fetch cannot
// read a body incrementally, so this rides XMLHttpRequest and parses the
// server-sent events out of responseText as it grows. Same headers as
// src/lib/api.ts so auth, language and tenant selection match every other
// call.

import { Platform } from "react-native";
import { API_BASE, APP_VERSION, ApiFailure, getCredential } from "@/lib/api";

export type CardField = { label: { en: string; es: string }; before?: string | null; after: string | { en: string; es: string } };

export type ActionCard = {
  id: string;
  toolName: string;
  status: string;
  title: { en: string; es: string };
  fields: CardField[];
  messageTexts?: { lang: "en" | "es"; text: string }[];
  recipientCount?: number;
  warning?: { en: string; es: string };
  requiresTypedConfirm: boolean;
  proposedAt: string;
  expiresAtMs: number;
};

export type StreamEvent =
  | { t: "open" }
  | { t: "session"; sessionId: string }
  | { t: "tool"; name: string }
  | { t: "reply"; text: string }
  | { t: "card"; card: ActionCard }
  | { t: "executed"; card: ActionCard }
  | { t: "card_status"; card: ActionCard }
  | { t: "error"; message: string; code?: string }
  | { t: "done"; continuable?: boolean; turn?: number };

export type StreamOutcome = { ok: boolean; error?: { en: string; es: string }; code?: string; continueTurn?: number };

export type ChatBody = {
  sessionId?: string | null;
  message?: string;
  confirmActionId?: string;
  confirmText?: string;
  cancelActionId?: string;
  continueTurn?: boolean;
  turn?: number;
};

function headers(lang: "en" | "es"): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "text/event-stream, application/json",
    "Content-Type": "application/json",
    "x-gl-lang": lang,
    "x-gl-platform": Platform.OS === "android" ? "android" : "ios",
    "x-gl-app-version": APP_VERSION,
  };
  const credential = getCredential();
  if (credential.kind === "guest") h.Authorization = `Guest ${credential.token}`;
  if (credential.kind === "user") {
    h.Authorization = `Bearer ${credential.jwt}`;
    if (credential.tenantSlug) h["x-gl-tenant"] = credential.tenantSlug;
  }
  return h;
}

const GENERIC = {
  en: "The Coordinator could not finish that. Please try again.",
  es: "El Coordinador no pudo terminar eso. Inténtelo de nuevo.",
};

/**
 * POSTs `body` to `path` (a /api/mobile/v1 path) and calls `onEvent` for every
 * event as it arrives. Resolves with the outcome once the stream closes. A
 * JSON refusal (status >= 400, no stream) rejects with ApiFailure.
 */
export function streamPost(
  path: string,
  body: ChatBody,
  onEvent: (event: StreamEvent) => void,
  opts: { lang: "en" | "es"; signal?: AbortSignal; timeoutMs?: number }
): Promise<StreamOutcome> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let outcome: StreamOutcome = { ok: true };
    let settled = false;
    let sawEvent = false;
    const finish = (o: StreamOutcome) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    const abort = (err: ApiFailure) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const consume = (chunk: string) => {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) return;
      let event: StreamEvent;
      try {
        event = JSON.parse(line.slice(5).trim()) as StreamEvent;
      } catch {
        return;
      }
      sawEvent = true;
      if (event.t === "error") outcome = { ...outcome, ok: false, error: { en: event.message, es: event.message }, code: event.code };
      if (event.t === "done" && event.continuable) outcome = { ...outcome, continueTurn: event.turn ?? 1 };
      onEvent(event);
    };

    const drain = (final: boolean) => {
      const text = xhr.responseText ?? "";
      let split = text.indexOf("\n\n", cursor);
      while (split >= 0) {
        consume(text.slice(cursor, split));
        cursor = split + 2;
        split = text.indexOf("\n\n", cursor);
      }
      if (final && text.slice(cursor).trim()) {
        consume(text.slice(cursor));
        cursor = text.length;
      }
    };

    xhr.open("POST", `${API_BASE}/api/mobile/v1${path}`);
    const h = headers(opts.lang);
    for (const k of Object.keys(h)) xhr.setRequestHeader(k, h[k]);
    xhr.timeout = opts.timeoutMs ?? 120_000;

    xhr.onprogress = () => {
      const type = xhr.getResponseHeader("content-type") ?? "";
      if (!type.includes("event-stream")) return;
      drain(false);
    };
    xhr.onload = () => {
      const type = xhr.getResponseHeader("content-type") ?? "";
      if (!type.includes("event-stream")) {
        let json: { ok?: boolean; error?: { code: string; message_en: string; message_es: string } } | null = null;
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          json = null;
        }
        abort(new ApiFailure(xhr.status || 500, json?.error ?? null));
        return;
      }
      drain(true);
      finish(outcome);
    };
    xhr.onerror = () =>
      abort(
        new ApiFailure(0, {
          code: "offline",
          message_en: "You seem to be offline. Check the connection and try again.",
          message_es: "Parece que no tiene conexión. Revise la conexión e inténtelo de nuevo.",
        })
      );
    xhr.ontimeout = () => {
      // Whatever arrived is durable server-side; report a soft failure.
      drain(true);
      finish({ ...outcome, ok: false, error: outcome.error ?? GENERIC });
    };
    xhr.onabort = () => finish({ ...outcome, ok: sawEvent, error: sawEvent ? undefined : GENERIC });
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(JSON.stringify(body));
  });
}
