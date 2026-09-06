// Language ladder: app setting, then device locale, then the wedding's
// locale_default (applied by the session once a wedding is known), else EN.

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
  /** The wedding's default, applied only while the user has not chosen. */
  applyTenantDefault: (l: Lang | null | undefined) => void;
};

const LangContext = createContext<Ctx | null>(null);

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode?.toLowerCase() ?? "en";
  return code === "es" ? "es" : "en";
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
    (l: Lang | null | undefined) => {
      if (!explicit && (l === "en" || l === "es")) setLangState(l);
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
