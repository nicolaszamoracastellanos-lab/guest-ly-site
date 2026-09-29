// Streaming client for the Coordinator routes. React Native's fetch cannot
// read a body incrementally, so this rides XMLHttpRequest and parses the
// server-sent events out of responseText as it grows. Same headers as
// src/lib/api.ts so auth, language and tenant selection match every other
// call.

import { API_BASE, ApiFailure, authHeaders } from "@/lib/api";
import { relayAuthStatus } from "@/features/shared/requests";

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


const GENERIC = {
  en: "The Coordinator could not finish that. Please try again.",
  es: "El Coordinador no pudo terminar eso. Inténtalo de nuevo.",
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

    xhr.timeout = opts.timeoutMs ?? 120_000;

    xhr.onprogress = () => {
      const type = xhr.getResponseHeader("content-type") ?? "";
      if (!type.includes("event-stream")) return;
      drain(false);
    };
    xhr.onload = () => {
      const type = xhr.getResponseHeader("content-type") ?? "";
      // Session expiry and a retired app version run the same handlers as
      // every other API call.
      relayAuthStatus(xhr.status);
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
          message_es: "Parece que no tienes conexión. Revisa la conexión e inténtalo de nuevo.",
        })
      );
    xhr.ontimeout = () => {
      // Whatever arrived is durable server-side; report a soft failure.
      drain(true);
      finish({ ...outcome, ok: false, error: outcome.error ?? GENERIC });
    };
    xhr.onabort = () => finish({ ...outcome, ok: sawEvent, error: sawEvent ? undefined : GENERIC });
    opts.signal?.addEventListener("abort", () => {
      if (xhr.readyState === XMLHttpRequest.UNSENT) finish({ ...outcome, ok: false, error: GENERIC });
      else xhr.abort();
    });
    // The same headers as every API call, with a live (refreshed) token.
    void authHeaders({ Accept: "text/event-stream, application/json", "x-gl-lang": opts.lang }).then((h) => {
      if (settled || opts.signal?.aborted) return;
      xhr.open("POST", `${API_BASE}/api/mobile/v1${path}`);
      for (const k of Object.keys(h)) xhr.setRequestHeader(k, h[k]);
      xhr.send(JSON.stringify(body));
    });
  });
}
