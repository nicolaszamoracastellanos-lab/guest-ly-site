// Language ladder, top wins (Part 9 audit, D-041):
//   1. the language the user chose in the app (stored as gl.lang)
//   2. the device language, when it is English or Spanish
//   3. the guest's own language from the guest record (guests only)
//   4. the wedding's locale_default (applied by the session once a wedding is known)
//   5. English
// Steps 3 and 4 only ever apply on a phone set to a third language. They used to
// override step 2, so an English phone could flip to Spanish after opening a wedding.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { en, type Copy } from "./en";
import { es } from "./es";
import { setApiLanguage } from "@/lib/api";

export type Lang = "en" | "es";

const KEY = "gl.lang";
const DICT: Record<Lang, Copy> = { en, es };

type Ctx = {
  lang: Lang;
  explicit: boolean;
  copy: Copy;
  setLang: (l: Lang) => void;
  /** The wedding's default (and, for guests, the guest's own language first).
   *  Applied only while the user has not chosen AND the device speaks neither
   *  English nor Spanish. */
  applyTenantDefault: (l: Lang | string | null | undefined, guestLanguage?: string | null) => void;
};

const LangContext = createContext<Ctx | null>(null);

/** The device language when it is one the app speaks, else null. */
function deviceLangExact(): Lang | null {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code === "es" || code === "en" ? code : null;
}

function deviceLang(): Lang {
  return deviceLangExact() ?? "en";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang());
  const [explicit, setExplicit] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "en" || v === "es") {
          setLangState(v);
          setExplicit(true);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    setApiLanguage(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setExplicit(true);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const applyTenantDefault = useCallback(
    (l: Lang | string | null | undefined, guestLanguage?: string | null) => {
      if (explicit || deviceLangExact()) return;
      const pick = guestLanguage === "en" || guestLanguage === "es" ? guestLanguage : l;
      if (pick === "en" || pick === "es") setLangState(pick);
    },
    [explicit]
  );

  const value = useMemo<Ctx>(
    () => ({ lang, explicit, copy: DICT[lang], setLang, applyTenantDefault }),
    [lang, explicit, setLang, applyTenantDefault]
  );
  if (!ready) return null;
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang outside LangProvider");
  return ctx;
}

/** Shorthand: the current dictionary. */
export function useCopy(): Copy {
  return useLang().copy;
}

/** "{name} ..." interpolation. Missing keys stay visible for QA. */
export function fmt(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? `{${k}}` : String(v);
  });
}

/** A value the API may send as plain text or as { en, es }. Never prints
 *  "[object Object]" and never hands an object to a Text node. */
export function localized(v: string | { en?: string | null; es?: string | null } | null | undefined, lang: Lang): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.en || v.es || "";
}

/** Singular and plural forms: plural(1, f) gives f.one, anything else f.other.
 *  Both languages only need the two forms. "{n}" is filled in. */
export function plural(n: number | null | undefined, forms: { one: string; other: string }): string {
  const v = n ?? 0;
  return fmt(v === 1 ? forms.one : forms.other, { n: v });
}

/** Long date in the current language, e.g. "Saturday 21 March 2027". */
export function longDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Date with its year but no weekday, e.g. "21 Mar 2027". For headers and
 *  cards where a raw "2027-03-21" used to show. */
export function mediumDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "America/La_Paz" reads as "La Paz": the city part of the zone id, spaces
 *  for underscores. A raw zone id never goes on screen (Part 9 audit, D-020). */
export function zoneLabel(tz: string | null | undefined): string {
  if (!tz) return "";
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

/** Short date, e.g. "1 Feb". */
export function shortDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { day: "numeric", month: "short" });
}

/** Relative "2m", "3h", "Tue" style stamp for lists. */
export function relTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return lang === "es" ? "ahora" : "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return new Date(t).toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { weekday: "short" });
  return shortDate(new Date(t).toISOString(), lang);
}
