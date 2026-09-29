// Native binding. Optional on purpose: Android, web, Expo Go and any build
// made before this module existed have no "Storefront" module, and every one
// of them must read as "not the US storefront".
import { NativeModule, requireOptionalNativeModule } from "expo";

declare class StorefrontNative extends NativeModule<Record<string, never>> {
  getCountryCodeAsync(): Promise<string | null>;
}

export default requireOptionalNativeModule<StorefrontNative>("Storefront");
