import { LanguageProvider, useLang } from './LanguageContext';
import { ThemeEffects, useTheme } from '../theme/ThemeContext';
import { Logo } from './Logo';
import './overlay.css';

export type LegalKind = 'privacy' | 'terms' | 'refunds';

/* Static legal routes (/privacy, /terms, /refunds): one bilingual page per
   topic with the EN/ES toggle, prerendered to real files so they are
   crawlable on GitHub Pages. Deliberately light: no WebGL, just the themed
   static backdrop. */
function LegalBody({ kind }: { kind: LegalKind }) {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const page = t.legal.pages[kind];

  return (
    <div className="overlay-page legal-page">
      <header className="legal-page__top">
        <a href="/" className="nav__logo" aria-label="Guest-ly">
          <Logo />
        </a>
        <div className="legal-page__toggles">
          <div className="lang-toggle theme-toggle" role="group" aria-label={t.nav.theme.label}>
            <button type="button" className={theme === 'day' ? 'on' : ''} aria-pressed={theme === 'day'} aria-label={t.nav.theme.day} title={t.nav.theme.day} onClick={() => setTheme('day')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
              </svg>
            </button>
            <button type="button" className={theme === 'night' ? 'on' : ''} aria-pressed={theme === 'night'} aria-label={t.nav.theme.night} title={t.nav.theme.night} onClick={() => setTheme('night')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M20.6 14.5A8.6 8.6 0 0 1 9.5 3.4a.6.6 0 0 0-.8-.74 9.6 9.6 0 1 0 12.64 12.64.6.6 0 0 0-.74-.8Z" />
              </svg>
            </button>
          </div>
          <div className="lang-toggle" role="group" aria-label="Language">
            <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
              ES
            </button>
          </div>
        </div>
      </header>

      <main className="legal-page__main">
        <h1 className="legal-page__title">{page.title}</h1>
        <p className="legal-page__updated">{page.updated}</p>
        {page.sections.map((section) => (
          <section key={section.h} className="legal-page__section">
            <h2>{section.h}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
        ))}
        <p className="legal-page__contact">{t.legal.contactLine}</p>
        <a className="legal-page__back" href="/">
          {t.legal.backHome}
        </a>
      </main>
    </div>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  return (
    <LanguageProvider>
      <ThemeEffects />
      <div className="static-stage" aria-hidden="true" />
      <div className="overlay-root">
        <LegalBody kind={kind} />
      </div>
    </LanguageProvider>
  );
}
