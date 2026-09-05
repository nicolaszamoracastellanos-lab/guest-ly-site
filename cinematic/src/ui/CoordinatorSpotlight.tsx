import { useEffect, useState } from 'react';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { ScenarioPlayer } from './ScenarioPlayer';
import { useHashParam } from './useHashParam';

/* № 05 THE STAR: the AI Coordinator. Four quoted commands, each running a
   compact script that pauses at its confirmation card until the visitor
   presses Confirm. Below: the honest capability rail and pricing line. */
export function CoordinatorSpotlight() {
  const { t } = useLang();
  const { open } = useWizard();
  const c = t.coordinator;
  const deepLink = useHashParam('coordinator');
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (deepLink && c.scripts.some((s) => s.id === deepLink)) setActive(deepLink);
  }, [deepLink, c.scripts]);

  const activeScript = c.scripts.find((s) => s.id === active) ?? null;

  return (
    <section id="coordinator" className="section">
      <div className="container">
        <header className="sec-head reveal">
          <p className="sec-eyebrow">
            <span className="sec-no">{c.no}</span>
            <span className="sec-rule" aria-hidden="true" />
            <span className="badge">
              <span className="badge__dot" aria-hidden="true" />
              {c.badge}
            </span>
          </p>
          <h2 className="sec-title">
            {c.title.split('\n').map((line, i) => (
              <span key={i} className={i === 1 ? 'accent' : undefined}>
                {line}
              </span>
            ))}
          </h2>
          <p className="sec-intro">{c.intro}</p>
        </header>

        <div className="coord-spot reveal">
          <div className="cmd-chips" role="tablist" aria-label={c.badge}>
            {c.scripts.map((script) => (
              <button
                key={script.id}
                type="button"
                role="tab"
                aria-selected={active === script.id}
                className={active === script.id ? 'cmd-chip on' : 'cmd-chip'}
                onClick={() => setActive(script.id)}
              >
                <span aria-hidden="true">&ldquo;</span>
                {script.label}
                <span aria-hidden="true">&rdquo;</span>
              </button>
            ))}
          </div>

          <div className="glass coord-stage">
            {activeScript ? (
              <ScenarioPlayer key={activeScript.id} scenario={activeScript} autoPlay onReset={() => setActive(null)} />
            ) : (
              <p className="coord-stage__hint">{c.disclaimer}</p>
            )}
          </div>

          {/* Crawlable transcripts for all four scripts. */}
          <div hidden aria-hidden="true">
            {c.scripts.map((script) => (
              <div key={script.id}>
                {script.steps.map((step, i) => (step.text ? <p key={i}>{step.text}</p> : null))}
                <p>{script.endNote}</p>
              </div>
            ))}
          </div>

          <div className="coord-caps">
            <h3 className="coord-caps__title">{c.capsTitle}</h3>
            <ul className="coord-caps__list">
              {c.caps.map((cap) => (
                <li key={cap}>
                  <span className="tick" aria-hidden="true">
                    ✓
                  </span>
                  {cap}
                </li>
              ))}
            </ul>
            <p className="coord-caps__closing">{c.capsClosing}</p>
            <div className="coord-caps__cta">
              <p className="coord-caps__price">{c.priceLine}</p>
              <div className="coord-caps__row">
                <button type="button" className="btn btn--gold-line" onClick={() => open()}>
                  {c.cta}
                </button>
                <a className="coord-caps__link" href="#pricing">
                  {c.seePricing}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
