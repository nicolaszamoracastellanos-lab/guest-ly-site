import { useEffect, useState } from 'react';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { Logo } from './Logo';

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
        <a href="#hero" className="nav__logo" onClick={closeMenu} aria-label="Guest-ly — home">
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
          <LangToggle />
          <button type="button" className="btn btn--gold" onClick={() => open()}>
            {t.nav.cta}
          </button>
        </div>

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
          <LangToggle className="lang-toggle--menu" />
          <button type="button" className="btn btn--gold btn--lg" onClick={startOrder} tabIndex={menuOpen ? 0 : -1}>
            {t.nav.cta}
          </button>
        </div>
      </div>
    </header>
  );
}
