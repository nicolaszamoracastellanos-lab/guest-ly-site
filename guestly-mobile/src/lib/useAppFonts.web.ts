// Web only: load the six faces at runtime under their file names (the names
// src/ui/tokens.ts uses off iOS). Subpath imports, so only these six files are
// bundled. A font that fails to load never blocks the app: the caller treats
// an error as loaded and the system font stands in.

import { useFonts } from "expo-font";
import { CormorantGaramond_400Regular_Italic } from "@expo-google-fonts/cormorant-garamond/400Regular_Italic";
import { CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond/500Medium";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond/600SemiBold";
import { Jost_400Regular } from "@expo-google-fonts/jost/400Regular";
import { Jost_500Medium } from "@expo-google-fonts/jost/500Medium";
import { Jost_600SemiBold } from "@expo-google-fonts/jost/600SemiBold";

export function useAppFonts(): [loaded: boolean, error: Error | null] {
  const [loaded, error] = useFonts({
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });
  return [loaded || !!error, error];
}
