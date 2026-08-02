import { useState } from 'react';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';

/* № 08 Pricing: three one-time tiers from the canonical pricing block. Each
   card keeps its 4 headline features and gains a "See everything included"
   expander with the full truthful list. The competitor table lives in the
   Compare section; a quiet link points there. */
export function Pricing() {
  const { t } = useLang();
  const { open } = useWizard();
  const p = t.pricing;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section id="pricing" className="section">
      <div className="container">
        <SectionHeader no={p.no} kicker={p.kicker} title={p.title} intro={p.intro} />

        <div className="plan-grid">
          {p.plans.map((plan) => {
            const isOpen = !!expanded[plan.id];
            const fullList = p.fullLists[plan.id];
            return (
              <div key={plan.id} className="reveal">
                <div className={plan.popular ? 'glass plan plan--popular' : 'glass plan'}>
                  {plan.popular && <span className="plan__ribbon">{p.popularTag}</span>}
                  <h3 className="plan__name">{plan.name}</h3>
                  <p className="plan__channels">{plan.guests}</p>
                  <p className="plan__price">
                    <span className="plan__cur" aria-hidden="true">
                      $
                    </span>
                    <span className="plan__num">{plan.price}</span>
                  </p>
                  <p className="plan__fee">{plan.priceNote}</p>
                  <ul className="plan__features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <span className="tick" aria-hidden="true">
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="plan__more"
                    aria-expanded={isOpen}
                    aria-controls={`plan-full-${plan.id}`}
                    onClick={() => setExpanded((v) => ({ ...v, [plan.id]: !v[plan.id] }))}
                  >
                    {p.fullListLabel}
                    <span className={isOpen ? 'faq-plus is-open' : 'faq-plus'} aria-hidden="true">
                      +
                    </span>
                  </button>
                  <div className="plan__full" id={`plan-full-${plan.id}`} inert={!isOpen}>
                    <div className={isOpen ? 'plan__full-inner is-open' : 'plan__full-inner'}>
                      <ul className="plan__features plan__features--full">
                        {fullList.map((f) => (
                          <li key={f}>
                            <span className="tick" aria-hidden="true">
                              ✓
                            </span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={plan.popular ? 'btn btn--gold btn--lg plan__cta' : 'btn btn--gold-line btn--lg plan__cta'}
                    onClick={() => open(plan.id)}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="plan-footnote reveal">{p.channelsFootnote}</p>

        <p className="zola-line reveal">
          <span className="zola-line__mark" aria-hidden="true">
            ✦
          </span>
          {p.zolaLine}
          <a className="zola-line__link" href="#compare">
            {`${p.compareLink} →`}
          </a>
        </p>

        <div className="glass coord-strip reveal">
          <span className="badge">{p.coordinator.badge}</span>
          <p className="coord-strip__body">
            <strong>{p.coordinator.name}</strong>
            {` ${p.coordinator.body}`}
            <a href="#coordinator">{`${p.coordLink} →`}</a>
          </p>
        </div>

        <p className="guarantee reveal">
          <span className="guarantee__mark" aria-hidden="true">
            ✦
          </span>
          {p.guarantee}
        </p>
      </div>
    </section>
  );
}
