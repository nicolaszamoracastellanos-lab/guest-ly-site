// Download the branded .xlsx from the mobile API and hand it to the share
// sheet. Mirrors the auth headers of src/lib/api.ts (which does not export
// them): Bearer JWT, tenant, language, platform, app version.

import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { API_BASE, APP_VERSION, ApiFailure, getCredential } from "@/lib/api";

export type ExportPreset = "full" | "attending" | "declined" | "pending" | "contacts" | "event" | "seating" | "dietary" | "per_person";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function headers(lang: "en" | "es"): Record<string, string> {
  const h: Record<string, string> = {
    Accept: XLSX,
    "x-gl-lang": lang,
    "x-gl-platform": Platform.OS === "android" ? "android" : "ios",
    "x-gl-app-version": APP_VERSION,
  };
  const credential = getCredential();
  if (credential.kind === "user") {
    h.Authorization = `Bearer ${credential.jwt}`;
    if (credential.tenantSlug) h["x-gl-tenant"] = credential.tenantSlug;
  }
  return h;
}

export async function exportGuests(opts: { preset: ExportPreset; granularity?: "party" | "person"; lang: "en" | "es" }): Promise<void> {
  const q = new URLSearchParams({ preset: opts.preset, granularity: opts.granularity ?? (opts.preset === "per_person" ? "person" : "party") });
  const url = `${API_BASE}/api/mobile/v1/couple/exports/guests?${q.toString()}`;
  const name = `guest-ly-${opts.preset}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const target = new File(Paths.cache, name);
  try {
    if (target.exists) target.delete();
  } catch {
    // A stale file from a previous export is harmless.
  }
  const res = await fetch(url, { headers: headers(opts.lang) });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { ok: false; error: { code: string; message_en: string; message_es: string } } | null;
    throw new ApiFailure(res.status, json?.error ?? null);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  target.write(bytes);
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiFailure(0, { code: "share_unavailable", message_en: "Sharing is not available on this device.", message_es: "Compartir no está disponible en este dispositivo." });
  }
  await Sharing.shareAsync(target.uri, { mimeType: XLSX, UTI: "org.openxmlformats.spreadsheetml.sheet", dialogTitle: name });
}
