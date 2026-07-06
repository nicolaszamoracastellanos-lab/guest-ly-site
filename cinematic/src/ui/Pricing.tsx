import { useState } from 'react';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';

export function Pricing() {
  const { t } = useLang();
  const { open } = useWizard();
  const p = t.pricing;
  const [range, setRange] = useState(0);

  return (
    <section id="pricing" className="section">
      <div className="container">
        <SectionHeader no={p.no} kicker={p.kicker} title={p.title} intro={p.intro} />

        <div className="range-picker reveal">
          <div className="range-pills" role="group" aria-label={p.rangeSub}>
            {p.ranges.map((r, i) => (
              <button
                key={r}
                type="button"
                className={i === range ? 'pill on' : 'pill'}
                aria-pressed={i === range}
                onClick={() => setRange(i)}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="range-sub">{p.rangeSub}</p>
        </div>

        <div className="plan-grid">
          {p.plans.map((plan) => (
            <div key={plan.id} className={plan.popular ? 'glass plan plan--popular reveal' : 'glass plan reveal'}>
              {plan.popular && <span className="plan__ribbon">{p.popularTag}</span>}
              <h3 className="plan__name">{plan.name}</h3>
              <p className="plan__channels">{plan.channels}</p>
              <p className="plan__price">
                <span className="plan__cur" aria-hidden="true">
                  $
                </span>
                {/* key remount = quick fade/slide when the guest range changes */}
                <span key={range} className="plan__num">
                  {plan.prices[range]}
                </span>
              </p>
              <p className="plan__fee">{plan.feeNote}</p>
              <p className="plan__hosting">{plan.hosting}</p>
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
                onClick={() => open(plan.id, range)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="addons reveal">
          {p.addons.map((a) => (
            <span key={a.label} className="addon-chip">
              <strong>{a.price}</strong> {a.label}
            </span>
          ))}
        </div>
        <p className="pricing-note reveal">{p.note}</p>
        <p className="value-line reveal">{p.valueLine}</p>
      </div>
    </section>
  );
}
