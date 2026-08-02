import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';
import { FoundingProof } from './FoundingProof';

/* The Founding Couples section: the true origin story, present tense.
   Replaces the old testimonials. The founding offer lives here, and only
   here. Real testimonials will render via FoundingProof when they exist. */
export function Founding() {
  const { t } = useLang();
  const { open } = useWizard();
  const f = t.founding;

  return (
    <section id="founding" className="section">
      <div className="container">
        <SectionHeader no={f.no} kicker={f.kicker} title={f.title} />
        <div className="founding-grid">
          <div className="founding-story reveal">
            {f.body.map((paragraph, i) => (
              <p key={i} className="founding-story__p">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="glass founding reveal">
            <span className="badge">
              <span className="badge__dot" aria-hidden="true" />
              {f.offer.badge}
            </span>
            <p className="founding__body">{f.offer.body}</p>
            <p className="founding__ends">{f.offer.ends}</p>
            <button type="button" className="btn btn--gold founding__cta" onClick={() => open()}>
              {f.offer.cta}
            </button>
          </div>
        </div>
        <FoundingProof items={f.proof} />
      </div>
    </section>
  );
}
