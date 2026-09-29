// Native: the six faces are embedded in the binary by the expo-font config
// plugin (app.config.ts), so there is nothing to load and nothing to wait for.
// Web loads them at runtime: see useAppFonts.web.ts.

export function useAppFonts(): [loaded: boolean, error: Error | null] {
  return [true, null];
}
