import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { copy } from '../copy';
import type { Locale, SiteCopy } from '../copy';

interface LanguageValue {
  lang: Locale;
  setLang: (lang: Locale) => void;
  t: SiteCopy;
}

const STORAGE_KEY = 'guestly-lang';

const LanguageContext = createContext<LanguageValue | null>(null);

function readStoredLang(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    /* storage unavailable (private mode etc.): fall through */
  }
  return 'en';
}

/* title: the document title for this page in the active language; the home
   page's meta title when absent. */
export function LanguageProvider({ children, title }: { children: ReactNode; title?: (t: SiteCopy, lang: Locale) => string }) {
  /* When hydrating over prerendered EN markup, start in EN to match the
     server DOM; the stored choice applies right after mount. */
  const [lang, setLang] = useState<Locale>(() =>
    (window as unknown as { __glHydrating?: boolean }).__glHydrating ? 'en' : readStoredLang(),
  );

  useEffect(() => {
    const flagged = window as unknown as { __glHydrating?: boolean };
    if (flagged.__glHydrating) {
      flagged.__glHydrating = false;
      const stored = readStoredLang();
      if (stored !== 'en') setLang(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = title ? title(copy[lang], lang) : copy[lang].meta.title;
  }, [lang, title]);

  /* Stored only when the visitor picks a language, like the theme: a visit
     alone leaves nothing on the device (#23, decision D23). */
  const choose = useCallback((next: Locale) => {
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal */
    }
  }, []);

  const value = useMemo<LanguageValue>(() => ({ lang, setLang: choose, t: copy[lang] }), [lang, choose]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
