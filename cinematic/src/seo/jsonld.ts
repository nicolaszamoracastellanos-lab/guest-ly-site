/* JSON-LD for index.html, built from the same copy the page renders.
   vite.config.ts injects the result at build time in place of the
   JSON_LD_MARKER comment, so the Product offers always carry the plan
   cards' names, prices and guest caps (src/pricing.ts), and the FAQPage
   carries the visible answers of the EN FAQ items marked `ld: true`.
   scripts/check-jsonld.mjs compares the built page against it. */

import type { SiteCopy } from '../copy.ts';
import { CURRENCY } from '../pricing.ts';

export const JSON_LD_MARKER = '<!-- json-ld: generated from src/seo/jsonld.ts at build time -->';

const SITE = 'https://guest-ly.com/';
const PRODUCT_DESCRIPTION =
  'AI wedding concierge for guests on WhatsApp and the web, a wedding website with per-person RSVPs, and a private couple portal.';

export function productLd(t: SiteCopy) {
  const p = t.pricing;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Guest-ly',
    description: PRODUCT_DESCRIPTION,
    brand: { '@type': 'Brand', name: 'Guest-ly' },
    url: SITE,
    offers: p.plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      description: `${plan.guests}. ${plan.features.join('; ')}. ${p.maintenanceLine}`,
      price: String(plan.price),
      priceCurrency: CURRENCY,
      url: `${SITE}#pricing`,
    })),
  };
}

export function faqLd(t: SiteCopy) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items
      .filter((item) => item.ld)
      .map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
  };
}

/* "<" is escaped so no copy string can close the script element early. */
function scriptTag(data: unknown): string {
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

export function jsonLdScripts(t: SiteCopy): string {
  return `${scriptTag(productLd(t))}\n${scriptTag(faqLd(t))}`;
}
