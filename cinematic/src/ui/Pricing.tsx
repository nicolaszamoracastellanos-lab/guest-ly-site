import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';

/* Pricing — three one-time tiers, Coordinator add-on strip, Founding Couples
   banner, guarantee line, and the competitor comparison table. Pure DOM
   overlay content; the WebGL world underneath is untouched. */
export function Pricing() {
  const { t, lang } = useLang();
  const { open } = useWizard();
  const p = t.pricing;
  const cmp = p.comparison;
  const yesLabel = lang === 'es' ? 'Incluido' : 'Included';
  const noLabel = lang === 'es' ? 'No incluido' : 'Not included';

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

        <div className="glass coord-strip reveal">
          <span className="badge">{p.coordinator.badge}</span>
          <p className="coord-strip__body">
            <strong>{p.coordinator.name}</strong> {p.coordinator.body}
          </p>
        </div>

        <div className="glass founding reveal">
          <span className="badge">
            <span className="badge__dot" aria-hidden="true" />
            {p.founding.badge}
          </span>
          <p className="founding__body">{p.founding.body}</p>
          <p className="founding__ends">{p.founding.ends}</p>
        </div>

        <p className="guarantee reveal">
          <span className="guarantee__mark" aria-hidden="true">
            ✦
          </span>
          {p.guarantee}
        </p>

        <div className="cmp-table-block reveal">
          <h3 className="cmp-table__title">{cmp.title}</h3>
          <p className="cmp-table__sub">{cmp.sub}</p>
          <div className="glass cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">{cmp.sub}</span>
                  </th>
                  {cmp.columns.map((c) => (
                    <th scope="col" key={c.name} className={c.highlight ? 'is-us' : undefined}>
                      <span className="cmp-table__name">{c.name}</span>
                      <span className="cmp-table__colsub">{c.sub}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cmp.rows.map((row, ri) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {cmp.columns.map((c) => (
                      <td key={c.name} className={c.highlight ? 'is-us' : undefined}>
                        {c.cells[ri] ? (
                          <span className="cmp-yes" role="img" aria-label={yesLabel}>
                            ✓
                          </span>
                        ) : (
                          <span className="cmp-no" role="img" aria-label={noLabel}>
                            ✕
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="cmp-table__price-row">
                  <th scope="row">{cmp.priceRow}</th>
                  {cmp.columns.map((c) => (
                    <td key={c.name} className={c.highlight ? 'is-us' : undefined}>
                      {c.price}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="cmp-table__note">{cmp.note}</p>
        </div>
      </div>
    </section>
  );
}
