import { useEffect, useSyncExternalStore } from 'react';
import { followSystemTheme, getTheme, setTheme, subscribeTheme } from './theme';
import type { Theme } from './theme';

/* React binding over the plain theme store. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(
    (onStoreChange) => subscribeTheme(onStoreChange),
    getTheme,
    () => 'night' as Theme,
  );
  return { theme, setTheme };
}

/* Mount once: keeps the theme following the OS while no explicit choice. */
export function ThemeEffects() {
  useEffect(() => followSystemTheme(), []);
  return null;
}
