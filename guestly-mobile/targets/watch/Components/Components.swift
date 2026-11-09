import SwiftUI

// Shared building blocks. Sizes are the design's px / 2, scaled by Theme.s.

/// Black screen, title row, content. The system draws the clock (top right),
/// so the right of the title row stays empty.
struct ScreenFrame<Content: View>: View {
  let title: String?
  var trailing: String? = nil
  var gap: CGFloat = 7
  @ViewBuilder var content: () -> Content

  var body: some View {
    VStack(alignment: .leading, spacing: sc(gap)) {
      if let title {
        HStack(alignment: .firstTextBaseline, spacing: sc(6)) {
          Text(title).font(Theme.bodyMedium(15)).foregroundStyle(Color.glGold)
          if let trailing { Text(trailing).font(Theme.body(12)).foregroundStyle(Color.glMuted).lineLimit(1).minimumScaleFactor(0.7) }
        }
        .padding(.leading, sc(6))
        .frame(height: sc(20), alignment: .leading)
      }
      content()
    }
    .padding(.horizontal, sc(12))
    .padding(.top, sc(15))
    .padding(.bottom, sc(14))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color.glBlack.ignoresSafeArea())
  }
}

/// The brand gem: a gold square turned 45 degrees.
struct Gem: View {
  var size: CGFloat = 8
  var color: Color = .glGold
  var body: some View {
    Rectangle().fill(color).frame(width: sc(size), height: sc(size)).rotationEffect(.degrees(45)).accessibilityHidden(true)
  }
}

/// 30 pt navy circle with a 9 pt gem (alert headers).
struct GemBadge: View {
  var body: some View {
    Circle().fill(Color.glNavy).frame(width: sc(30), height: sc(30)).overlay(Gem(size: 9)).accessibilityHidden(true)
  }
}

/// "Guest" + gem + italic "ly".
struct Wordmark: View {
  var body: some View {
    HStack(spacing: sc(3.5)) {
      Text("Guest").font(Theme.display(16))
      Gem(size: 4.5).offset(y: sc(3))
      Text("ly").font(Theme.displayItalic(16))
    }
    .foregroundStyle(Color.glIvory)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Guest-ly")
  }
}

struct PrimaryButton: View {
  let title: String
  var height: CGFloat = 44
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      Text(title).font(Theme.bodySemibold(15)).foregroundStyle(Color.glInk)
        .lineLimit(1).minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity).frame(height: sc(height))
        .background(Capsule().fill(Color.glGold))
    }
    .buttonStyle(.plain)
  }
}

struct SecondaryButton<Icon: View>: View {
  let title: String
  var height: CGFloat = 44
  var fontSize: CGFloat = 15
  @ViewBuilder var icon: () -> Icon
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      HStack(spacing: sc(6)) {
        icon()
        Text(title).font(Theme.bodyMedium(fontSize)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity).frame(height: sc(height))
      .background(Capsule().fill(Color.glButtonDark))
    }
    .buttonStyle(.plain)
  }
}

extension SecondaryButton where Icon == EmptyView {
  init(title: String, height: CGFloat = 44, fontSize: CGFloat = 15, action: @escaping () -> Void) {
    self.init(title: title, height: height, fontSize: fontSize, icon: { EmptyView() }, action: action)
  }
}

/// Row or card background. Night by default, navy when highlighted.
struct CardBackground: ViewModifier {
  var highlight = false
  var radius: CGFloat = 14
  func body(content: Content) -> some View {
    content.background(RoundedRectangle(cornerRadius: sc(radius), style: .continuous).fill(highlight ? Color.glNavy : Color.glNight))
  }
}

extension View {
  func card(highlight: Bool = false, radius: CGFloat = 14) -> some View {
    modifier(CardBackground(highlight: highlight, radius: radius))
  }
}

struct ProgressBar: View {
  let fraction: Double
  var height: CGFloat = 4
  var track: Color = .glTrack
  var fill: Color = .glGold
  var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule().fill(fill).frame(width: g.size.width * CGFloat(min(1, max(0, fraction))))
      }
    }
    .frame(height: sc(height))
  }
}

struct RingProgress: View {
  let fraction: Double
  var lineWidth: CGFloat = 8
  var track: Color = .glTrack
  var fill: Color = .glGold
  var body: some View {
    ZStack {
      Circle().stroke(track, lineWidth: sc(lineWidth))
      Circle().trim(from: 0, to: CGFloat(min(1, max(0, fraction))))
        .stroke(fill, style: StrokeStyle(lineWidth: sc(lineWidth), lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
  }
}

struct CheckCircle: View {
  let done: Bool
  var size: CGFloat = 22
  var body: some View {
    ZStack {
      if done {
        Circle().fill(Color.glGold)
        GlyphView(paths: [Glyph.check], size: sc(size * 0.55), color: .glInk, line: 2.6)
      } else {
        Circle().strokeBorder(Color.glGold, lineWidth: sc(1.5))
      }
    }
    .frame(width: sc(size), height: sc(size))
    .accessibilityHidden(true)
  }
}

struct CallCircle: View {
  var primary = true
  var size: CGFloat = 30
  var body: some View {
    Circle().fill(primary ? Color.glGold : Color.glTrack).frame(width: sc(size), height: sc(size))
      .overlay(GlyphView(paths: [Glyph.phone], size: sc(14), color: primary ? .glInk : .glGoldLight))
      .accessibilityHidden(true)
  }
}

/// Microphone glyph (capsule, arc, stem) in a colour.
struct MicGlyph: View {
  var size: CGFloat = 15
  var color: Color = .glGoldLight
  var line: CGFloat = 2
  var body: some View { GlyphView(paths: [Glyph.micCapsule, Glyph.micArc, Glyph.micStem], size: size, color: color, line: line) }
}

/// Small caps label: Jost, tracked, uppercase.
struct CapsLabel: View {
  let text: String
  var size: CGFloat = 11
  var color: Color = .glGoldLight
  var tracking: CGFloat = 2
  var body: some View {
    Text(text).font(Theme.bodySemibold(size)).tracking(tracking * Theme.s).textCase(.uppercase).foregroundStyle(color)
  }
}

/// Proportional segments (CSS flex-grow), 2 pt apart; zero-weight parts are skipped.
struct SegmentBar: View {
  let parts: [(Int, Color)]
  var body: some View {
    GeometryReader { g in
      let live = parts.filter { $0.0 > 0 }
      let total = Double(live.reduce(0) { $0 + $1.0 })
      let gaps = sc(2) * CGFloat(max(0, live.count - 1))
      HStack(spacing: sc(2)) {
        ForEach(Array(live.enumerated()), id: \.offset) { _, p in
          Capsule().fill(p.1).frame(width: (g.size.width - gaps) * CGFloat(Double(p.0) / max(total, 1)))
        }
      }
    }
  }
}
