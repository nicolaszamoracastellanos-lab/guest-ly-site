import { useEffect, useState } from 'react';
import { foundingOfferOpen } from '../config';
import { useLang } from './LanguageContext';
import { useWizard } from './WizardContext';
import { SectionHeader } from './Sections';
import { FoundingProof } from './FoundingProof';

/* Whether the offer card shows. While React hydrates the prerendered page
   it must match that markup (built on the build day), so the first render
   reads it from the DOM; right after mount the date decides. Outside
   hydration (dev, client render) the date decides at once. */
function useFoundingOfferOpen(): boolean {
  const [isOpen, setOpen] = useState(() =>
    (window as unknown as { __glHydrating?: boolean }).__glHydrating
      ? document.querySelector('#founding .founding') !== null
      : foundingOfferOpen(Date.now()),
  );
  useEffect(() => setOpen(foundingOfferOpen(Date.now())), []);
  return isOpen;
}

/* The Founding Couples section: the true origin story, present tense.
   Replaces the old testimonials. The founding offer lives here, and only
   here, and only until config.ts FOUNDING_ENDS. Real testimonials will
   render via FoundingProof when they exist. */
export function Founding() {
  const { t } = useLang();
  const { open } = useWizard();
  const offerOpen = useFoundingOfferOpen();
  const f = t.founding;

  return (
    <section id="founding" className="section">
      <div className="container">
        <SectionHeader no={f.no} kicker={f.kicker} title={f.title} />
        <div className={offerOpen ? 'founding-grid' : 'founding-grid founding-grid--solo'}>
          <div className="founding-story reveal">
            {f.body.map((paragraph, i) => (
              <p key={i} className="founding-story__p">
                {paragraph}
              </p>
            ))}
          </div>
          {offerOpen ? (
            <div className="glass founding reveal">
              <span className="badge">
                <span className="badge__dot" aria-hidden="true" />
                {f.offer.badge}
              </span>
              <p className="founding__body">{f.offer.body}</p>
              <p className="founding__ends">{f.offer.ends}</p>
              <button type="button" className="btn btn--gold founding__cta" onClick={() => open()} data-track="founding-start">
                {f.offer.cta}
              </button>
            </div>
          ) : null}
        </div>
        <FoundingProof items={f.proof} />
      </div>
    </section>
  );
}
