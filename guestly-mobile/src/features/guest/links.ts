// Every outside link on the guest screens goes through here. Couple-entered
// URLs arrive without a scheme ("google.com/maps/..."), which made new URL()
// throw inside a press handler (fatal in a release build) and made
// Linking.openURL reject with nobody listening. Nothing here ever throws.

import { Alert, Linking, Platform } from "react-native";
import { absoluteUrl, mapsQuery } from "./format";

/** Opens a link. A missing or unopenable one shows `failMessage` (when given)
 *  instead of doing nothing. */
export function openUrlSafe(url: string | null | undefined, failMessage?: string): void {
  const abs = absoluteUrl(url);
  if (!abs) {
    if (failMessage) Alert.alert(failMessage);
    return;
  }
  Linking.openURL(abs).catch(() => {
    if (failMessage) Alert.alert(failMessage);
  });
}

/** Directions. On iOS a Google Maps search link opens in Apple Maps with the
 *  same query (Google Maps in Safari is a poor second); anything else opens
 *  as given. */
export function openMaps(url: string | null | undefined, failMessage?: string): void {
  const abs = absoluteUrl(url);
  if (!abs) {
    if (failMessage) Alert.alert(failMessage);
    return;
  }
  const q = Platform.OS === "ios" ? mapsQuery(abs) : null;
  if (q) {
    Linking.openURL(`maps://?q=${encodeURIComponent(q)}`).catch(() => openUrlSafe(abs, failMessage));
    return;
  }
  openUrlSafe(abs, failMessage);
}
