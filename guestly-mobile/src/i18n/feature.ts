// Per-feature copy modules. Feature folders under src/features/<name>/copy.ts
// export { en, es } and read them through this hook so parallel feature work
// never edits the shared en.ts / es.ts dictionaries.
import { useLang } from "./index";

export function useFeatureCopy<T>(dict: { en: T; es: T }): T {
  const { lang } = useLang();
  return dict[lang];
}
