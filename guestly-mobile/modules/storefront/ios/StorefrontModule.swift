// The App Store storefront the person buys from, read from StoreKit 2.
//
// Why this exists: App Store guidelines 3.1.1 and 3.1.3 let an app link to an
// external purchase only on the United States storefront. The answer must come
// from StoreKit (the Apple account's storefront), never from the device
// locale or region, which a person can set to anything. JS treats any error,
// a nil storefront or a non-iOS platform as "not the US".

import ExpoModulesCore
import StoreKit

public class StorefrontModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Storefront")

    // ISO 3166-1 alpha-3 country code of the current storefront ("USA"), or
    // nil when StoreKit cannot tell (no Apple account, restricted device).
    AsyncFunction("getCountryCodeAsync") { () async -> String? in
      guard let storefront = await Storefront.current else { return nil }
      return storefront.countryCode
    }
  }
}
