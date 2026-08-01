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
          <div className="lang-toggle" role="group" aria-label={t.nav.theme.label}>
            <button type="button" className={theme === 'day' ? 'on' : ''} aria-pressed={theme === 'day'} onClick={() => setTheme('day')}>
              {t.nav.theme.day}
            </button>
            <button type="button" className={theme === 'night' ? 'on' : ''} aria-pressed={theme === 'night'} onClick={() => setTheme('night')}>
              {t.nav.theme.night}
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
