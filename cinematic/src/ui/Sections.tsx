import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { GlassCard } from './GlassCard';

/* Shared editorial section header: "№ 0x — KICKER" + display title + intro. */
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

/* ------------------------------------------------------------- Channels */
export function Channels() {
  const { t } = useLang();
  const c = t.channels;
  return (
    <section id="channels" className="section">
      <div className="container">
        <SectionHeader no={c.no} kicker={c.kicker} title={c.title} intro={c.intro} />
        <div className="channel-grid">
          {c.items.map((item) => (
            <GlassCard key={item.name} className="channel-card reveal">
              <h3 className="card-title">{item.name}</h3>
              <p className="card-body">{item.desc}</p>
              <span className="plan-tag">{item.plans}</span>
            </GlassCard>
          ))}
        </div>
        <div className="glass unify reveal">
          <span className="unify__sym" aria-hidden="true">
            ∞
          </span>
          <div>
            <h3 className="unify__title">{c.unify.title}</h3>
            <p className="unify__body">{c.unify.body}</p>
          </div>
        </div>
      </div>
    </section>
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
        <SectionHeader no={h.no} kicker={h.kicker} title={h.title} intro={h.intro} />
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

/* ------------------------------------------------------ What's included */
export function Included() {
  const { t } = useLang();
  const inc = t.included;
  return (
    <section id="included" className="section">
      <div className="container">
        <SectionHeader no={inc.no} kicker={inc.kicker} title={inc.title} intro={inc.intro} />
        <div className="feature-grid">
          {inc.items.map((item) => (
            <GlassCard key={item.title} className="feature-card reveal">
              <h3 className="card-title card-title--sm">{item.title}</h3>
              <p className="card-body">{item.body}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- The couple portal */
export function Platform() {
  const { t } = useLang();
  const pl = t.platform;
  return (
    <section id="platform" className="section">
      <div className="container">
        <SectionHeader no={pl.no} kicker={pl.kicker} title={pl.title} intro={pl.intro} />
        <div className="feature-grid">
          {pl.items.map((item) => (
            <GlassCard key={item.title} className="feature-card reveal">
              <h3 className="card-title card-title--sm">{item.title}</h3>
              <p className="card-body">{item.body}</p>
            </GlassCard>
          ))}
        </div>
        <div className="glass coord reveal">
          <span className="badge coord__badge">{pl.coordinator.badge}</span>
          <h3 className="coord__title">{pl.coordinator.title}</h3>
          <p className="coord__body">{pl.coordinator.body}</p>
          <div className="coord__examples">
            {pl.coordinator.examples.map((ex) => (
              <span key={ex} className="badge-chip coord__chip">
                {ex}
              </span>
            ))}
          </div>
          <p className="coord__note">{pl.coordinator.note}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- The difference */
export function Difference() {
  const { t } = useLang();
  const c = t.compare;
  return (
    <section id="difference" className="section">
      <div className="container">
        <SectionHeader no={c.no} kicker={c.kicker} title={c.title} />
        <div className="cmp-grid">
          <div className="glass cmp cmp--without reveal">
            <span className="cmp__label">{c.without.label}</span>
            <h3 className="cmp__title">{c.without.title}</h3>
            <ul className="cmp__list">
              {c.without.points.map((p, i) => (
                <li key={i}>
                  <span className="cmp__mark" aria-hidden="true">
                    ✕
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass cmp cmp--with reveal">
            <span className="cmp__label">{c.withG.label}</span>
            <h3 className="cmp__title">{c.withG.title}</h3>
            <ul className="cmp__list">
              {c.withG.points.map((p, i) => (
                <li key={i}>
                  <span className="cmp__mark" aria-hidden="true">
                    ✦
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Testimonials */
export function Testimonials() {
  const { t } = useLang();
  const s = t.testimonials;
  return (
    <section id="testimonials" className="section">
      <div className="container">
        <SectionHeader no={s.no} kicker={s.kicker} title={s.title} intro={s.intro} />
        <div className="testi-grid">
          {s.items.map((item) => (
            <GlassCard key={item.names} className="testi reveal">
              <span className="testi__stars" aria-hidden="true">
                ★★★★★
              </span>
              <blockquote className="testi__quote">“{item.quote}”</blockquote>
              <footer className="testi__who">
                <span className="testi__avatar" aria-hidden="true">
                  {item.emoji}
                </span>
                <span className="testi__id">
                  <span className="testi__names">{item.names}</span>
                  <span className="testi__place">{item.place}</span>
                </span>
              </footer>
            </GlassCard>
          ))}
        </div>
        <div className="testi-badges reveal">
          {s.badges.map((b) => (
            <span key={b} className="badge-chip">
              <span aria-hidden="true">✦</span> {b}
            </span>
          ))}
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
        <p className="final-cta__body">{c.body}</p>
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
