import { useState } from 'react';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';

/* № 06 rebuilt: the order-to-live journey as a day-marked stepper. Single
   open step (FAQ mechanics), numbered dots on a connected gold rail. */
export function HowStepper() {
  const { t } = useLang();
  const { open } = useWizard();
  const h = t.how;
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section id="how" className="section">
      <div className="container">
        <SectionHeader no={h.no} kicker={h.kicker} title={h.title} intro={h.intro || undefined} />

        <ol className="stepper reveal">
          {h.steps.map((step, i) => {
            const isOpen = openIdx === i;
            return (
              <li key={step.n} className={isOpen ? 'stepper__item is-open' : 'stepper__item'}>
                <button
                  type="button"
                  className="stepper__head"
                  aria-expanded={isOpen}
                  aria-controls={`step-${step.n}`}
                  onClick={() => setOpenIdx(isOpen ? -1 : i)}
                >
                  <span className="stepper__dot" aria-hidden="true">
                    {step.n}
                  </span>
                  <span className="stepper__labels">
                    <span className="stepper__day">
                      {step.day}
                      {step.timeChip && <em className="stepper__chip">{step.timeChip}</em>}
                    </span>
                    <span className="stepper__title">{step.title}</span>
                  </span>
                  <span className="pillar__plus" aria-hidden="true">
                    +
                  </span>
                </button>
                <div className="stepper__body" id={`step-${step.n}`} inert={!isOpen}>
                  <div className="stepper__inner">
                    <p className="stepper__lead">{step.body}</p>
                    <ul className="stepper__details">
                      {step.details.map((d) => (
                        <li key={d}>
                          <span className="tick" aria-hidden="true">
                            ✓
                          </span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
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
