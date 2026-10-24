// Native binding. Optional on purpose: Android, web, Expo Go and any build made
// before this module existed have no "GuestlyDuo" module, and every one of them
// must read as "no fold, no camera region".
import { NativeModule, requireOptionalNativeModule } from "expo";

export type NativeRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  marginTop: number;
  marginLeft: number;
  marginBottom: number;
  marginRight: number;
  active: boolean;
};

export type NativeRegions = { division: NativeRegion | null; occlusions: NativeRegion[] };

declare class GuestlyDuoNative extends NativeModule<Record<string, never>> {
  isAvailable(): boolean;
  getReservedRegionsAsync(): Promise<NativeRegions>;
}

export default requireOptionalNativeModule<GuestlyDuoNative>("GuestlyDuo");
