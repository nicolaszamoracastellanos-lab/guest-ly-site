// iPhone Duo reserved regions, for React Native.
//
// Apple (Tech Talk 111463, "Strike a pose"): the fold and the cameras are
// "reserved regions". A division region (the fold) divides a larger area into
// two and is active only while the phone is half folded; an occlusion region
// (the under-display camera) hides content. Touches that land on a reserved
// region are suppressed unless the layout avoids it, and plain safe area
// insets do not describe either. React Native has no API for them, so this
// module reads them from the key window and hands JS plain rectangles in the
// window's coordinate space (the React root fills the window, so they match
// React Native's layout coordinates).
//
// The module only READS. Hinge angle and status come from expo-hinge; JS asks
// again whenever those or the window size change.

import ExpoModulesCore
import UIKit

struct DuoRegion: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0
  /// Margins included in the frame around the reserved rect for interactive content.
  @Field var marginTop: Double = 0
  @Field var marginLeft: Double = 0
  @Field var marginBottom: Double = 0
  @Field var marginRight: Double = 0
  @Field var active: Bool = false
}

struct DuoRegions: Record {
  /// The fold, or nil when the phone has no fold (any other iPhone, iOS before 27.1).
  @Field var division: DuoRegion? = nil
  @Field var occlusions: [DuoRegion] = []
}

public class GuestlyDuoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GuestlyDuo")

    // True when this build and this OS can report reserved regions.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 27.1, *) { return true }
      return false
    }

    // Division and occlusion regions of the key window, including inactive
    // ones (so a grid can prefer an even column count whenever a fold exists,
    // as Apple suggests). UIKit state, so it runs on the main queue.
    AsyncFunction("getReservedRegionsAsync") { () -> DuoRegions in
      let out = DuoRegions()
      guard #available(iOS 27.1, *) else { return out }
      guard let window = Self.keyWindow() else { return out }
      out.division = window.reservedRegions(kind: .division, options: [.includeInactive]).first.map(Self.convert)
      out.occlusions = window.reservedRegions(kind: .occlusion, options: [.includeInactive]).map(Self.convert)
      return out
    }.runOnQueue(.main)
  }

  private static func keyWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let active = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    return active?.windows.first { $0.isKeyWindow } ?? active?.windows.first
  }

  @available(iOS 27.1, *)
  private static func convert(_ r: UIView.ReservedRegion) -> DuoRegion {
    let d = DuoRegion()
    d.x = Double(r.frame.origin.x)
    d.y = Double(r.frame.origin.y)
    d.width = Double(r.frame.size.width)
    d.height = Double(r.frame.size.height)
    d.marginTop = Double(r.margins.top)
    d.marginLeft = Double(r.margins.left)
    d.marginBottom = Double(r.margins.bottom)
    d.marginRight = Double(r.margins.right)
    d.active = r.isActive
    return d
  }
}
