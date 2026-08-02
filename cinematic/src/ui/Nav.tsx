import { useEffect, useState } from 'react';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { useTheme } from '../theme/ThemeContext';
import { Logo } from './Logo';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.6 14.5A8.6 8.6 0 0 1 9.5 3.4a.6.6 0 0 0-.8-.74 9.6 9.6 0 1 0 12.64 12.64.6.6 0 0 0-.74-.8Z" />
    </svg>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { t } = useLang();
  const { theme, setTheme } = useTheme();
  const labels = t.nav.theme;
  return (
    <div
      className={className ? `lang-toggle theme-toggle ${className}` : 'lang-toggle theme-toggle'}
      role="group"
      aria-label={labels.label}
    >
      <button
        type="button"
        className={theme === 'day' ? 'on' : ''}
        aria-pressed={theme === 'day'}
        aria-label={labels.day}
        title={labels.day}
        onClick={() => setTheme('day')}
      >
        <SunIcon />
      </button>
      <button
        type="button"
        className={theme === 'night' ? 'on' : ''}
        aria-pressed={theme === 'night'}
        aria-label={labels.night}
        title={labels.night}
        onClick={() => setTheme('night')}
      >
        <MoonIcon />
      </button>
    </div>
  );
}

function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={className ? `lang-toggle ${className}` : 'lang-toggle'} role="group" aria-label="Language">
      <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </button>
      <button type="button" className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
        ES
      </button>
    </div>
  );
}

export function Nav() {
  const { t } = useLang();
  const { open } = useWizard();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('menu-locked', menuOpen);
    return () => document.documentElement.classList.remove('menu-locked');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const startOrder = () => {
    closeMenu();
    open();
  };

  return (
    <header
      className={['nav', scrolled || menuOpen ? 'nav--scrolled' : '', menuOpen ? 'nav--open' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="nav__inner">
        <a href="#hero" className="nav__logo" onClick={closeMenu} aria-label="Guest-ly: home">
          <Logo />
        </a>

        <nav className="nav__links" aria-label="Primary">
          {t.nav.links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="nav__actions">
          <a className="nav__login" href={t.nav.login.href}>
            {t.nav.login.label}
          </a>
          <ThemeToggle />
          <LangToggle />
          <button type="button" className="btn btn--gold" onClick={() => open()}>
            {t.nav.cta}
          </button>
        </div>

        {/* Always-visible language + theme switches on phones; desktop shows
            the ones in nav__actions instead. */}
        <ThemeToggle className="lang-toggle--bar theme-toggle--bar" />
        <LangToggle className="lang-toggle--bar" />

        <button
          type="button"
          className={menuOpen ? 'nav__burger is-open' : 'nav__burger'}
          aria-expanded={menuOpen}
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div className={menuOpen ? 'nav__menu is-open' : 'nav__menu'} aria-hidden={!menuOpen}>
        <nav className="nav__menu-links" aria-label="Menu">
          {t.nav.links.map((l) => (
            <a key={l.href} href={l.href} onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
              {l.label}
            </a>
          ))}
          <a href={t.nav.login.href} className="nav__menu-login" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
            {t.nav.login.label}
          </a>
        </nav>
        <div className="nav__menu-foot">
          <div className="nav__menu-toggles">
            <ThemeToggle className="lang-toggle--menu" />
            <LangToggle className="lang-toggle--menu" />
          </div>
          <button type="button" className="btn btn--gold btn--lg" onClick={startOrder} tabIndex={menuOpen ? 0 : -1}>
            {t.nav.cta}
          </button>
        </div>
      </div>
    </header>
  );
}
