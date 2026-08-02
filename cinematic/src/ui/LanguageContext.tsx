import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

export function LanguageProvider({ children }: { children: ReactNode }) {
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
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* non-fatal */
    }
    document.documentElement.lang = lang;
    document.title = copy[lang].meta.title;
  }, [lang]);

  const value = useMemo<LanguageValue>(() => ({ lang, setLang, t: copy[lang] }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
