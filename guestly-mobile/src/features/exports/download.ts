// Download the branded .xlsx from the mobile API and hand it to the share
// sheet. The same headers as every API call (authHeaders in src/lib/api.ts):
// the live JWT, tenant, device, language, platform, app version.

import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { API_BASE, ApiFailure, authHeaders } from "@/lib/api";
import { relayAuthStatus } from "@/features/shared/requests";

export type ExportPreset = "full" | "attending" | "declined" | "pending" | "contacts" | "event" | "seating" | "dietary" | "per_person";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EXPORT_TIMEOUT_MS = 60_000;

export async function exportGuests(opts: { preset: ExportPreset; granularity?: "party" | "person"; lang: "en" | "es"; signal?: AbortSignal }): Promise<void> {
  const q = new URLSearchParams({ preset: opts.preset, granularity: opts.granularity ?? (opts.preset === "per_person" ? "person" : "party") });
  const url = `${API_BASE}/api/mobile/v1/couple/exports/guests?${q.toString()}`;
  const name = `guest-ly-${opts.preset}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const target = new File(Paths.cache, name);
  try {
    if (target.exists) target.delete();
  } catch {
    // A stale file from a previous export is harmless.
  }
  // A stalled download gives up after a minute; the caller can also cancel.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  let bytes: Uint8Array;
  try {
    let res: Response;
    try {
      const h = await authHeaders({ Accept: XLSX, "x-gl-lang": opts.lang });
      delete h["Content-Type"]; // a GET with no body
      res = await fetch(url, { headers: h, signal: controller.signal });
    } catch {
      throw new ApiFailure(0, {
        code: "offline",
        message_en: "The export did not finish. Check your connection and try again.",
        message_es: "La exportación no terminó. Revisa tu conexión e inténtalo de nuevo.",
      });
    }
    if (!res.ok) {
      relayAuthStatus(res.status);
      const json = (await res.json().catch(() => null)) as { ok: false; error: { code: string; message_en: string; message_es: string } } | null;
      throw new ApiFailure(res.status, json?.error ?? null);
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
  if (opts.signal?.aborted) return;
  target.write(bytes);
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiFailure(0, { code: "share_unavailable", message_en: "Sharing is not available on this device.", message_es: "Compartir no está disponible en este dispositivo." });
  }
  await Sharing.shareAsync(target.uri, { mimeType: XLSX, UTI: "org.openxmlformats.spreadsheetml.sheet", dialogTitle: name });
}
