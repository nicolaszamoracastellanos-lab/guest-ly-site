import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';
import { FoundingProof } from './FoundingProof';

/* The origin section: the true origin story, present tense. Replaced the old
   testimonials. The Founding Couples offer that once sat beside it is gone
   for good (Nicolas, Nov 5 2026). Real testimonials will render via
   FoundingProof when they exist. The section keeps id="founding": the
   analytics section list (#23) names it that way. */
export function Founding() {
  const { t } = useLang();
  const f = t.founding;

  return (
    <section id="founding" className="section">
      <div className="container">
        <SectionHeader no={f.no} kicker={f.kicker} title={f.title} />
        <div className="founding-story reveal">
          {f.body.map((paragraph, i) => (
            <p key={i} className="founding-story__p">
              {paragraph}
            </p>
          ))}
        </div>
        <FoundingProof items={f.proof} />
      </div>
    </section>
  );
}
