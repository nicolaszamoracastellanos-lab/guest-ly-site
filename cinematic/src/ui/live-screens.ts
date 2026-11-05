/* #24 Live app screens: the pure half of <LiveScreen> (no React, no DOM),
   shared by the component, scripts/live-screens.mjs (which writes the
   manifest) and scripts/test-live-screens.mjs.

   A manifest names one version folder under /screens/ and, per tour pane
   id, the pixel size of the largest image of each language and form.
   Every image path is derived from those, never stored:
     /screens/<version>/<id>.<lang>.<form>.<width>.webp
   A pane missing from the manifest keeps its placeholder (today: every
   pane, the CSS vignettes of MockScreens.tsx). */

export type ScreenLang = 'en' | 'es';
export type ScreenForm = 'desktop' | 'phone';
export const SCREEN_LANGS: readonly ScreenLang[] = ['en', 'es'];
export const SCREEN_FORMS: readonly ScreenForm[] = ['desktop', 'phone'];

/* [width, height] of the widest image of that form; smaller widths keep the ratio. */
export type ScreenSize = readonly [number, number];
export type ScreenEntry = Record<ScreenLang, Record<ScreenForm, ScreenSize>>;

export interface LiveScreensManifest {
  /* Folder under /screens/, e.g. "20261120-1a2b3c4d"; '' means no shots yet. */
  version: string;
  /* Image widths written per form, ascending (1x and 2x of the slot). */
  widths: Record<ScreenForm, readonly number[]>;
  screens: Readonly<Record<string, ScreenEntry>>;
}

/* The tour switches to its two-column layout at 880px (overlay.css,
   .tour__layout); the desktop shot shows there, the phone shot below. */
export const DESKTOP_MIN_WIDTH = 880;
/* Slot widths the images are sized for: the desktop column is 278 to 435px
   wide (880 to 1240+), the phone frame is 260px (overlay.css .live-screen). */
export const SIZES: Record<ScreenForm, string> = {
  desktop: '(min-width: 1240px) 435px, 35vw',
  phone: '260px',
};

export const SAFE_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const SAFE_VERSION = /^[0-9]{8}-[0-9a-f]{7,12}$/;

export function screenPath(version: string, id: string, lang: ScreenLang, form: ScreenForm, width: number): string {
  return `/screens/${version}/${id}.${lang}.${form}.${width}.webp`;
}

/* Height of an image of `width` for a size, rounded like the pipeline does. */
export function heightFor(size: ScreenSize, width: number): number {
  return Math.round((size[1] * width) / size[0]);
}

export interface ScreenSource {
  srcSet: string;
  sizes: string;
  src: string;
  width: number;
  height: number;
}

export interface ResolvedScreen {
  desktop: ScreenSource;
  phone: ScreenSource;
}

/* What <LiveScreen> renders for a pane in a language, or null to keep the
   placeholder. Width and height are the smallest image's, so the box has its
   final aspect ratio before any byte arrives (no layout shift). */
export function resolveScreen(m: LiveScreensManifest, id: string, lang: ScreenLang): ResolvedScreen | null {
  const entry = m.version ? m.screens[id] : undefined;
  if (!entry) return null;
  const one = (form: ScreenForm): ScreenSource => {
    const size = entry[lang][form];
    const widths = m.widths[form];
    return {
      srcSet: widths.map((w) => `${screenPath(m.version, id, lang, form, w)} ${w}w`).join(', '),
      sizes: SIZES[form],
      src: screenPath(m.version, id, lang, form, widths[0]),
      width: widths[0],
      height: heightFor(size, widths[0]),
    };
  };
  return { desktop: one('desktop'), phone: one('phone') };
}

/* Every file the manifest implies, as paths under /screens/. */
export function manifestFiles(m: LiveScreensManifest): string[] {
  if (!m.version) return [];
  const files: string[] = [];
  for (const id of Object.keys(m.screens))
    for (const lang of SCREEN_LANGS)
      for (const form of SCREEN_FORMS) for (const w of m.widths[form]) files.push(screenPath(m.version, id, lang, form, w));
  return files;
}

/* Shape problems; empty means the manifest is usable. `paneIds` are the
   tour's pane ids (copy.ts), so a shot for a pane that does not exist fails. */
export function manifestProblems(m: LiveScreensManifest, paneIds: readonly string[]): string[] {
  const problems: string[] = [];
  const ids = Object.keys(m.screens);
  if (!m.version) {
    if (ids.length) problems.push('screens are listed but version is empty');
    return problems;
  }
  if (!SAFE_VERSION.test(m.version)) problems.push(`version "${m.version}" is not YYYYMMDD-<portal commit>`);
  for (const form of SCREEN_FORMS) {
    const w = m.widths[form];
    if (!w || w.length === 0) problems.push(`no widths for ${form}`);
    else if (w.some((x, i) => !Number.isInteger(x) || x <= 0 || (i > 0 && x <= w[i - 1])))
      problems.push(`${form} widths ${w.join(',')} must be positive integers, ascending`);
  }
  if (ids.length === 0) problems.push('a version with no screens');
  for (const id of ids) {
    if (!SAFE_ID.test(id)) problems.push(`screen id "${id}" is not a plain lowercase id`);
    if (!paneIds.includes(id)) problems.push(`screen "${id}" is not a tour pane (copy.ts platform.items)`);
    for (const lang of SCREEN_LANGS)
      for (const form of SCREEN_FORMS) {
        const size = m.screens[id]?.[lang]?.[form];
        if (!size || size.length !== 2 || !size.every((n) => Number.isInteger(n) && n > 0))
          problems.push(`screen "${id}" has no ${lang} ${form} size`);
        else if (m.widths[form]?.length && size[0] !== m.widths[form][m.widths[form].length - 1])
          problems.push(`screen "${id}" ${lang} ${form} is ${size[0]}px wide, not the largest width ${m.widths[form].at(-1)}`);
      }
  }
  return problems;
}
