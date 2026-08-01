import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';

/* Pricing: three one-time tiers from the canonical pricing block, the
   Coordinator add-on strip and the guarantee. The competitor table is gone;
   one quiet line replaces it. The Founding offer lives in the Founding
   section now, one place only. */
export function Pricing() {
  const { t } = useLang();
  const { open } = useWizard();
  const p = t.pricing;

  return (
    <section id="pricing" className="section">
      <div className="container">
        <SectionHeader no={p.no} kicker={p.kicker} title={p.title} intro={p.intro} />

        <div className="plan-grid">
          {p.plans.map((plan) => (
            <div key={plan.id} className={plan.popular ? 'glass plan plan--popular reveal' : 'glass plan reveal'}>
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
                className={plan.popular ? 'btn btn--gold btn--lg plan__cta' : 'btn btn--gold-line btn--lg plan__cta'}
                onClick={() => open(plan.id)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="zola-line reveal">
          <span className="zola-line__mark" aria-hidden="true">
            ✦
          </span>
          {p.zolaLine}
        </p>

        <div className="glass coord-strip reveal">
          <span className="badge">{p.coordinator.badge}</span>
          <p className="coord-strip__body">
            <strong>{p.coordinator.name}</strong> {p.coordinator.body}
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
