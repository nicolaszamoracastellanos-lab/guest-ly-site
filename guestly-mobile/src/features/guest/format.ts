// Pure formatting helpers for the guest screens. No React, no native modules,
// so scripts/check-guest-format.mjs can exercise them in plain node.

/**
 * A couple-typed time to minutes since local midnight, or null when unclear.
 * Accepts "16:30", "16.30", "18h30", "18 h 30", "16h", "4:30 pm", "4:30PM",
 * "4 p.m.", "6.30pm", "12 am", "16:30 hrs" and ranges ("16:30 - 18:00" gives
 * the start). A 24-hour value with a stray am/pm ("16:00 pm") keeps 16:00.
 */
export function parseClock(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const re = /(?:^|[^\d])(\d{1,2})(?:\s*[:.hH]\s*(\d{2}))?(?!\d)\s*(a\.?\s?m\b\.?|p\.?\s?m\b\.?|hrs?\b\.?|h\b)?/gi;
  for (const m of String(raw).matchAll(re)) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const suffix = (m[3] ?? "").toLowerCase().replace(/[.\s]/g, "");
    // A bare number with no minutes and no suffix ("Day 2", "Table 12") is not a time.
    if (!m[2] && !suffix) continue;
    if (h > 23 || min > 59) continue;
    if (suffix.startsWith("p") && h < 12) h += 12;
    if (suffix.startsWith("a") && h === 12) h = 0;
    return h * 60 + min;
  }
  return null;
}

/**
 * The label for an event time. Spanish reads 24-hour ("16:30"), English reads
 * 12-hour ("4:30 pm"). The local parse of the couple's text wins, the server's
 * start_minutes is the fallback, and text neither can read shows as written.
 */
export function clockLabel(minutes: number | null | undefined, raw: string | null | undefined, lang: "en" | "es"): string {
  const m = parseClock(raw) ?? (typeof minutes === "number" && minutes >= 0 && minutes < 24 * 60 ? minutes : null);
  if (m === null) return (raw ?? "").trim();
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  if (lang === "es") return `${h}:${mm}`;
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "am" : "pm"}`;
}

/** "Camila & Andrés" becomes two display lines: "Camila" and "& Andrés".
 *  "&" splits with or without spaces; "y", "and" and "e" only as whole words,
 *  so "Tony & Ana" and "Emily y Juan" never lose a letter. */
export function splitNames(names: string): [string, string] {
  const s = (names ?? "").trim();
  const m = s.match(/^(.+?)\s*&\s*(.+)$/) ?? s.match(/^(.+?)\s+(?:y|and|e)\s+(.+)$/i);
  return m ? [m[1].trim(), `& ${m[2].trim()}`] : [s, ""];
}

/** A couple-entered link made absolute: "google.com/maps/..." gets https://.
 *  Returns null for an empty or unusable value. */
export function absoluteUrl(url: string | null | undefined): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  if (/^[^\s/]+\.[^\s]+/.test(v)) return `https://${v}`;
  return null;
}

/** The search text of a Google Maps link, for handing to Apple Maps. */
export function mapsQuery(url: string): string | null {
  if (!/google\.[^/]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(url)) return null;
  const q = url.match(/[?&](?:query|q|destination|daddr)=([^&#]+)/i);
  if (!q) return null;
  try {
    return decodeURIComponent(q[1].replace(/\+/g, " "));
  } catch {
    return q[1];
  }
}

/** Six invite characters out of whatever was typed or pasted: "abc-123",
 *  " ABC 123 ", "Your code: ABC123." all give "ABC123". In a sentence a code
 *  with a digit wins, then a code written in groups, then the last six-letter
 *  word (codes come at the end of "Your code is CAMAND"). */
export function extractInviteCode(text: string, len = 6): string {
  const upper = (text ?? "").toUpperCase();
  const exact = [...upper.matchAll(new RegExp(`(?:^|[^A-Z0-9])([A-Z0-9]{${len}})(?![A-Z0-9])`, "g"))].map((m) => m[1]);
  const withDigit = exact.find((t) => /\d/.test(t));
  if (withDigit) return withDigit;
  const grouped = [...upper.matchAll(new RegExp(`(?:^|[^A-Z0-9])((?:[A-Z0-9][\\s-]?){${len - 1}}[A-Z0-9])(?![A-Z0-9])`, "g"))]
    .map((m) => m[1])
    .filter((g) => /[\s-]/.test(g))
    .map((g) => g.replace(/[^A-Z0-9]/g, ""));
  const groupedDigit = grouped.find((g) => /\d/.test(g));
  if (groupedDigit) return groupedDigit;
  if (exact.length) return exact[exact.length - 1];
  if (grouped.length) return grouped[0];
  return upper.replace(/[^A-Z0-9]/g, "").slice(0, len);
}

/** Day and month in words, no weekday or year: "15 de marzo" / "15 March".
 *  For "Reply by ..." and "... days until ..." lines (build 12). */
export function dayMonth(iso: string | null | undefined, lang: "en" | "es"): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { day: "numeric", month: "long" });
}

/** "Ceremonia, cóctel y recepción" / "Ceremony, cocktail and reception":
 *  the first title as written, the rest in lower case, joined with "and". */
export function joinTitles(titles: string[], and: string): string {
  const parts = titles.filter(Boolean).map((t, i) => (i === 0 ? t : t.charAt(0).toLowerCase() + t.slice(1)));
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}
