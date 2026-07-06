import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { Logo } from './Logo';

export function Footer() {
  const { t } = useLang();
  const { open } = useWizard();
  const f = t.footer;
  const intakeMailto = `mailto:${f.contact.email}?subject=${encodeURIComponent(f.contact.intakeForm)}`;

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo className="footer__logo" />
          <p className="footer__blurb">{f.blurb}</p>
        </div>

        <nav className="footer__col" aria-label={f.explore.title}>
          <h3 className="footer__head">{f.explore.title}</h3>
          <ul>
            {f.explore.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <h3 className="footer__head">{f.contact.title}</h3>
          <ul>
            <li>
              <a href={`mailto:${f.contact.email}`}>{f.contact.email}</a>
            </li>
            <li>
              <button type="button" className="footer__link-btn" onClick={() => open()}>
                {f.contact.startOrder}
              </button>
            </li>
            <li>
              <a href={intakeMailto}>{f.contact.intakeForm}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container footer__base">
        <p>{f.copyright}</p>
        <p className="footer__crafted">{f.crafted}</p>
      </div>
    </footer>
  );
}
