import SwiftUI

/// Draws an SVG path string (M L H V C Q A Z, upper and lower case) scaled from
/// a 24 x 24 view box into the rect. The design uses its own stroke icons, so
/// the same path data is reused here instead of SF Symbols.
struct SVGShape: Shape {
  let d: String
  var box: CGFloat = 24

  func path(in rect: CGRect) -> Path {
    var p = SVGParser(d).parse()
    let k = min(rect.width, rect.height) / box
    p = p.applying(CGAffineTransform(scaleX: k, y: k))
    return p.offsetBy(dx: rect.minX, dy: rect.minY)
  }
}

private struct SVGParser {
  let chars: [Character]
  var i = 0
  init(_ d: String) { chars = Array(d) }

  mutating func parse() -> Path {
    var path = Path()
    var cur = CGPoint.zero, start = CGPoint.zero
    var cmd: Character = "M"
    while true {
      skipSep()
      guard i < chars.count else { break }
      if chars[i].isLetter { cmd = chars[i]; i += 1 }
      let rel = cmd.isLowercase
      switch cmd.uppercased() {
      case "M":
        let (x, y) = (num(), num())
        cur = CGPoint(x: rel ? cur.x + x : x, y: rel ? cur.y + y : y)
        start = cur
        path.move(to: cur)
        cmd = rel ? "l" : "L"
      case "L":
        let (x, y) = (num(), num())
        cur = CGPoint(x: rel ? cur.x + x : x, y: rel ? cur.y + y : y)
        path.addLine(to: cur)
      case "H":
        let x = num()
        cur.x = rel ? cur.x + x : x
        path.addLine(to: cur)
      case "V":
        let y = num()
        cur.y = rel ? cur.y + y : y
        path.addLine(to: cur)
      case "C":
        let a = pt(rel, cur), b = pt(rel, cur), c = pt(rel, cur)
        path.addCurve(to: c, control1: a, control2: b)
        cur = c
      case "Q":
        let a = pt(rel, cur), b = pt(rel, cur)
        path.addQuadCurve(to: b, control: a)
        cur = b
      case "A":
        let rx = num(), ry = num(), rot = num()
        let large = flag(), sweep = flag()
        let e = pt(rel, cur)
        addArc(&path, from: cur, to: e, rx: rx, ry: ry, rot: rot, large: large, sweep: sweep)
        cur = e
      case "Z":
        path.closeSubpath()
        cur = start
      default:
        i += 1
      }
    }
    return path
  }

  mutating func skipSep() { while i < chars.count, chars[i] == " " || chars[i] == "," || chars[i] == "\n" { i += 1 } }

  mutating func num() -> CGFloat {
    skipSep()
    var s = ""
    if i < chars.count, chars[i] == "-" || chars[i] == "+" { s.append(chars[i]); i += 1 }
    var dot = false
    while i < chars.count {
      let c = chars[i]
      if c.isNumber { s.append(c); i += 1 }
      else if c == ".", !dot { dot = true; s.append(c); i += 1 }
      else { break }
    }
    return CGFloat(Double(s) ?? 0)
  }

  mutating func flag() -> Bool { skipSep(); let c = chars[i]; i += 1; return c == "1" }

  mutating func pt(_ rel: Bool, _ cur: CGPoint) -> CGPoint {
    let x = num(), y = num()
    return CGPoint(x: rel ? cur.x + x : x, y: rel ? cur.y + y : y)
  }

  /// SVG endpoint arc to cubic Beziers (W3C implementation notes, F.6.5).
  func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat, rot: CGFloat, large: Bool, sweep: Bool) {
    var rx = abs(rx0), ry = abs(ry0)
    if rx == 0 || ry == 0 || p0 == p1 { path.addLine(to: p1); return }
    let phi = rot * .pi / 180
    let cp = cos(phi), sp = sin(phi)
    let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
    let x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy
    let lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
    if lam > 1 { rx *= sqrt(lam); ry *= sqrt(lam) }
    let sign: CGFloat = (large == sweep) ? -1 : 1
    let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    let co = sign * sqrt(max(0, num / den))
    let cxp = co * (rx * y1 / ry), cyp = co * (-ry * x1 / rx)
    let cx = cp * cxp - sp * cyp + (p0.x + p1.x) / 2
    let cy = sp * cxp + cp * cyp + (p0.y + p1.y) / 2
    func ang(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
      let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
      return a
    }
    let th1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
    var dth = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
    if !sweep && dth > 0 { dth -= 2 * .pi }
    if sweep && dth < 0 { dth += 2 * .pi }
    let n = Int(ceil(abs(dth) / (.pi / 2)))
    let step = dth / CGFloat(n)
    let t = 4.0 / 3.0 * tan(step / 4)
    var a = th1
    for _ in 0..<n {
      let b = a + step
      let (ca, sa, cb, sb) = (cos(a), sin(a), cos(b), sin(b))
      func map(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: cx + rx * x * cp - ry * y * sp, y: cy + rx * x * sp + ry * y * cp)
      }
      path.addCurve(to: map(cb, sb), control1: map(ca - t * sa, sa + t * ca), control2: map(cb + t * sb, sb - t * cb))
      a = b
    }
  }
}

enum Glyph {
  static let check = "M5 12.5l4.5 4.5L19 7.5"
  static let phone = "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
  static let micCapsule = "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"
  static let micArc = "M5.5 11a6.5 6.5 0 0 0 13 0"
  static let micStem = "M12 17.5V21"
}

/// A stroked glyph at a point size (24-unit design grid).
struct GlyphView: View {
  let paths: [String]
  let size: CGFloat
  let color: Color
  var line: CGFloat = 2

  var body: some View {
    ZStack {
      ForEach(paths, id: \.self) { d in
        SVGShape(d: d)
          .stroke(color, style: StrokeStyle(lineWidth: line * size / 24, lineCap: .round, lineJoin: .round))
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}
