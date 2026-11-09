import SwiftUI
import WatchKit

// The only place with colours, fonts and the size scale. Every number below is
// the design file's px value divided by 2 (the design is drawn at 2x for a
// 46 mm screen, 208 x 248 pt).

extension Color {
  init(hex: UInt32) {
    self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255, opacity: 1)
  }
  static let glBlack = Color(hex: 0x000000)
  static let glIvory = Color(hex: 0xf7f3ec)
  static let glIvorySoft = Color(hex: 0xd9d3c6)
  static let glMuted = Color(hex: 0xa8a08f)
  static let glGold = Color(hex: 0xc9a96e)
  static let glGoldLight = Color(hex: 0xe2c892)
  static let glInk = Color(hex: 0x14110c)
  static let glNight = Color(hex: 0x0d1117)
  static let glNavy = Color(hex: 0x16213a)
  static let glTrack = Color(hex: 0x1f2636)
  static let glTrackNavy = Color(hex: 0x2b3856)
  static let glButtonDark = Color(hex: 0x1a2030)
  static let glDeclined = Color(hex: 0x5a5446)
}

enum Theme {
  /// Scale for other watch sizes: screen width / 208, clamped 0.85 ... 1.05.
  static var s: CGFloat {
    let w = WKInterfaceDevice.current().screenBounds.width
    return min(1.05, max(0.85, w / 208))
  }

  static func display(_ size: CGFloat) -> Font { .custom("CormorantGaramond-SemiBold", fixedSize: size * s) }
  static func displayItalic(_ size: CGFloat) -> Font { .custom("CormorantGaramond-Italic", fixedSize: size * s) }
  static func displayMedium(_ size: CGFloat) -> Font { .custom("CormorantGaramond-Medium", fixedSize: size * s) }
  static func body(_ size: CGFloat) -> Font { .custom("Jost-Regular", fixedSize: size * s) }
  static func bodyMedium(_ size: CGFloat) -> Font { .custom("Jost-Medium", fixedSize: size * s) }
  static func bodySemibold(_ size: CGFloat) -> Font { .custom("Jost-SemiBold", fixedSize: size * s) }
}

extension View {
  /// Scaled point size for paddings and frames.
  func sc(_ v: CGFloat) -> CGFloat { v * Theme.s }
}

/// Free function form for places without a View in scope.
func sc(_ v: CGFloat) -> CGFloat { v * Theme.s }
