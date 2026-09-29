// Is this person buying from the United States App Store storefront?
//
// App Store guidelines 3.1.1 / 3.1.3 (owner decision, Sep 29 2026): the app
// may link out to activate a wedding on the web ONLY on the US storefront.
// Everywhere else it must show no price, no purchase wording and no link.
//
// The answer comes from StoreKit 2 (Storefront.current.countryCode, the Apple
// account's storefront) through the local module in modules/storefront. It
// never comes from the device locale or region, which anyone can change.
// Android, web, Expo Go, a build without the module, a nil storefront and
// any error all read as NOT the US: the safe default.
//
// Development only: EXPO_PUBLIC_STOREFRONT_OVERRIDE=USA (or any code) lets a
// simulator render the US variant for screenshots. It is ignored in release
// builds (__DEV__ is false there), so it can never change what users see.

import { Platform } from "react-native";
import StorefrontNative from "../../modules/storefront/src/StorefrontModule";

export type StorefrontAnswer = { countryCode: string | null; isUS: boolean };

let cached: Promise<StorefrontAnswer> | null = null;

async function read(): Promise<StorefrontAnswer> {
  if (__DEV__) {
    const override = process.env.EXPO_PUBLIC_STOREFRONT_OVERRIDE;
    if (override) return { countryCode: override, isUS: override === "USA" };
  }
  if (Platform.OS !== "ios" || !StorefrontNative) return { countryCode: null, isUS: false };
  try {
    const code = await Promise.race([
      StorefrontNative.getCountryCodeAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    const countryCode = typeof code === "string" && /^[A-Z]{3}$/.test(code) ? code : null;
    return { countryCode, isUS: countryCode === "USA" };
  } catch {
    return { countryCode: null, isUS: false };
  }
}

/** The storefront, read once per launch. A failed read is retried next time. */
export function getStorefront(): Promise<StorefrontAnswer> {
  if (!cached) {
    cached = read().then((answer) => {
      if (!answer.countryCode) cached = null;
      return answer;
    });
  }
  return cached;
}
