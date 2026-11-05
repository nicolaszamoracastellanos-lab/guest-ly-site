/* #50: the destinations the guides section offers, read at build time from
   the portal's destinations dataset (decision D24: one dataset, owned by
   Lane 6, src/lib/destinations/data/destinations.json). The page never holds
   its own list, so a guide the server cannot render is never offered.
   The portal checkout is found exactly like features.json for llms.txt
   (GL_PORTAL_DIR, else the nested deploy checkout); vite.config.ts calls this
   only while GUIDES_ENABLED is on, so a build with the switch off never
   needs the dataset.
   No dependencies besides node:fs and node:path. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findFeaturesJson } from '../llms.mjs';

export const DATASET_PATH = 'src/lib/destinations/data/destinations.json';
/* Same shape as the beacon's guide id (L7p schema CODE_RE). */
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* Only places a fact checker signed off and that carry guide sections. */
export function guideDestinations(dataset) {
  if (!dataset || !Array.isArray(dataset.destinations)) throw new Error('destinations dataset: no "destinations" list');
  const out = [];
  for (const d of dataset.destinations) {
    if (d.review_status !== 'fact_checked') continue;
    if (!d.guide || !Array.isArray(d.guide.sections) || d.guide.sections.length === 0) continue;
    if (!ID_RE.test(String(d.id))) throw new Error(`destinations dataset: id "${d.id}" is not a plain code`);
    const country = dataset.countries?.[d.country]?.name;
    if (!d.name?.en || !d.name?.es || !country?.en || !country?.es) throw new Error(`destinations dataset: ${d.id} lacks an EN or ES name`);
    out.push({ id: d.id, name: { en: d.name.en, es: d.name.es }, country: { en: country.en, es: country.es } });
  }
  return out;
}

export function loadGuideDestinations({ env = process.env } = {}) {
  const { portalDir } = findFeaturesJson({ env });
  const file = join(portalDir, DATASET_PATH);
  if (!existsSync(file)) {
    throw new Error(
      `GUIDES_ENABLED is on, but ${file} does not exist. The guides section lists the portal's destinations dataset; ` +
        'point GL_PORTAL_DIR at a portal checkout that has it.',
    );
  }
  const dataset = JSON.parse(readFileSync(file, 'utf8'));
  const list = guideDestinations(dataset);
  if (list.length === 0) throw new Error(`GUIDES_ENABLED is on, but ${file} has no fact-checked destination with a guide.`);
  return { list, file, version: dataset.version ?? '' };
}
