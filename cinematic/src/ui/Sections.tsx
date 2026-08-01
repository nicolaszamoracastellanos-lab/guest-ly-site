import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';

/* Shared editorial section header: "№ 0x + KICKER" + display title + intro. */
export function SectionHeader({
  no,
  kicker,
  title,
  intro,
  center,
}: {
  no: string;
  kicker: string;
  title: string;
  intro?: string;
  center?: boolean;
}) {
  return (
    <header className={center ? 'sec-head sec-head--center reveal' : 'sec-head reveal'}>
      <p className="sec-eyebrow">
        <span className="sec-no">{no}</span>
        <span className="sec-rule" aria-hidden="true" />
        <span className="sec-kicker">{kicker}</span>
      </p>
      <h2 className="sec-title">
        {title.split('\n').map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </h2>
      {intro ? <p className="sec-intro">{intro}</p> : null}
    </header>
  );
}

/* --------------------------------------------------------- How it works */
export function How() {
  const { t } = useLang();
  const { open } = useWizard();
  const h = t.how;
  return (
    <section id="how" className="section">
      <div className="container">
        <SectionHeader no={h.no} kicker={h.kicker} title={h.title} intro={h.intro || undefined} />
        <ol className="steps">
          {h.steps.map((s) => (
            <li key={s.n} className="step reveal">
              <span className="step__n" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__body">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="how__cta reveal">
          <button type="button" className="btn btn--gold btn--lg" onClick={() => open()}>
            {h.cta}
          </button>
          <p className="how__note">{h.ctaNote}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Final CTA */
export function FinalCta() {
  const { t } = useLang();
  const { open } = useWizard();
  const c = t.cta;
  return (
    <section className="section section--final">
      <div className="container final-cta reveal">
        <p className="sec-kicker">{c.kicker}</p>
        <h2 className="sec-title">
          {c.title.split('\n').map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </h2>
        {c.body ? <p className="final-cta__body">{c.body}</p> : null}
        <div className="final-cta__actions">
          <button type="button" className="btn btn--gold btn--lg" onClick={() => open()}>
            {c.primary}
          </button>
          <a className="btn btn--ghost btn--lg" href="#pricing">
            {c.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
