/* Types for guide-destinations.mjs (read by vite.config.ts). */
export type GuideDestination = { id: string; name: { en: string; es: string }; country: { en: string; es: string } };
export const DATASET_PATH: string;
export function guideDestinations(dataset: unknown): GuideDestination[];
export function loadGuideDestinations(opts?: { env?: Record<string, string | undefined> }): {
  list: GuideDestination[];
  file: string;
  version: string;
};
