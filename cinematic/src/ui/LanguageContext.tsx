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
    /* storage unavailable (private mode etc.) — fall through */
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Locale>(readStoredLang);

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
