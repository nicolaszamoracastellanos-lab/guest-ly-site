// Money and date formatting for the phone. Same rules as the portal's
// src/lib/budget.ts (copied, not imported: that file is server code).

import type { Lang } from "@/i18n";

const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-BO" };

/** Full money. The currency shows as its code in both languages ("USD 9,500.00",
 *  "USD 9.500,00"): a bare "$" is ambiguous for a wedding in Latin America, and
 *  in English it sat next to the "USD 34.3K" tiles on the same screen (Part 9
 *  release walk). Spanish already printed the code, so the widths are proven. */
export function formatMoney(amount: number, currency: string, lang: Lang): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(safe);
  } catch {
    return `${currency} ${plain(safe, lang, 2)}`;
  }
}

/** Compact money for tiles: "USD 251.5K" instead of 251,525.06. One format for
 *  every tile, so a row never mixes "USD 34.3K" with "$5,890.00", and nothing
 *  in a narrow tile is long enough to break mid number (Part 9 audit, D-008). */
export function formatMoneyShort(amount: number, currency: string, lang: Lang): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${currency} ${plain(abs / 1_000_000, lang, 1)}M`;
  if (abs >= 1_000) return `${sign}${currency} ${plain(abs / 1_000, lang, 1)}K`;
  return `${sign}${currency} ${plain(abs, lang, 0)}`;
}

export function formatQty(qty: number, lang: Lang): string {
  return plain(qty, lang, 3);
}

function plain(n: number, lang: Lang, maxFraction: number): string {
  try {
    return new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: maxFraction }).format(n);
  } catch {
    return String(Math.round(n * 100) / 100);
  }
}

/** "1 Sep 2026" from "2026-09-01", never shifted by a timezone. */
export function formatDay(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return iso;
  }
}

/** "September 2026" from "2026-09". */
export function formatMonth(key: string, lang: Lang): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
  } catch {
    return key;
  }
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** Accepts "1.234,56" and "1,234.56" alike. null when not a number. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  let normalized = s;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const after = s.length - lastComma - 1;
    normalized = after === 3 && (s.match(/,/g) ?? []).length === 1 && s.length > 4 ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  }
  const n = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function numText(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}
