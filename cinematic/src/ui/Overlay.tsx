import { useCallback, useEffect, useMemo, useState } from 'react';
import { LanguageProvider } from './LanguageContext';
import { WizardContext } from './WizardContext';
import type { PlanId, WizardApi } from './WizardContext';
import { Nav } from './Nav';
import { Hero } from './Hero';
import { Channels, How, Included, Difference, Testimonials, FinalCta } from './Sections';
import { Pricing } from './Pricing';
import { Faq } from './Faq';
import { Footer } from './Footer';
import { Wizard } from './Wizard';
import './overlay.css';

interface WizardRequest {
  id: number;
  plan: PlanId;
  range: number;
}

export function Overlay() {
  const [wizard, setWizard] = useState<WizardRequest | null>(null);

  const openWizard = useCallback((plan: PlanId = 'standard', range = 0) => {
    setWizard((prev) => ({ id: (prev?.id ?? 0) + 1, plan, range }));
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const wizardApi = useMemo<WizardApi>(() => ({ open: openWizard }), [openWizard]);

  /* Scroll reveals: one IntersectionObserver toggling `is-visible`.
     Content is visible by default — `.reveal` only hides once `body.js-ready`
     exists, so a missing observer/JS failure never blanks the page. */
  useEffect(() => {
    document.body.classList.add('js-ready');
    const els = Array.from(document.querySelectorAll<HTMLElement>('.overlay-page .reveal'));
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <LanguageProvider>
      <WizardContext.Provider value={wizardApi}>
        <div className="overlay-page">
          <Nav />
          <main>
            <Hero />
            <Channels />
            <How />
            <Included />
            <Difference />
            <Pricing />
            <Testimonials />
            <Faq />
            <FinalCta />
          </main>
          <Footer />
          {wizard && (
            <Wizard key={wizard.id} initialPlan={wizard.plan} initialRange={wizard.range} onClose={closeWizard} />
          )}
        </div>
      </WizardContext.Provider>
    </LanguageProvider>
  );
}
