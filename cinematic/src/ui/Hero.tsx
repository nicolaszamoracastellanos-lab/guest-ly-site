import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { ChatCard } from './ChatCard';

export function Hero() {
  const { t } = useLang();
  const { open } = useWizard();
  const h = t.hero;

  return (
    <>
      <section id="hero" className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="badge reveal">
              <span className="badge__dot" aria-hidden="true" />
              {h.badge}
            </span>
            <p className="hero__kicker reveal">{h.kicker}</p>
            <h1 className="hero__title reveal">
              {h.titleLines.map((line, i) => (
                <span key={i} className={i === h.accentIndex ? 'hero__line accent' : 'hero__line'}>
                  {line}
                </span>
              ))}
            </h1>
            <p className="hero__sub reveal">{h.sub}</p>
            <div className="hero__actions reveal">
              <button type="button" className="btn btn--gold btn--lg" onClick={() => open()}>
                {h.primary}
              </button>
              <a className="btn btn--ghost btn--lg" href="#how">
                {h.secondary}
              </a>
            </div>
            <div className="hero__stats reveal">
              {h.stats.map((s) => (
                <div key={s.label} className="stat">
                  <span className="stat__value">{s.value}</span>
                  <span className="stat__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero__visual reveal">
            <ChatCard />
          </div>
        </div>

        <div className="hero__hint" aria-hidden="true">
          {h.scrollHint}
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[0, 1].map((dup) => (
            <ul key={dup} className="marquee__list">
              {h.marquee.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </>
  );
}
