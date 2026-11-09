import SwiftUI

// NowNext.dc.html
struct NowNextView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let d = store.snapshot.dayOf
    ScreenFrame(title: L10n.t("weddingDay")) {
      if let now = d?.now {
        VStack(alignment: .leading, spacing: sc(3)) {
          HStack {
            CapsLabel(text: L10n.t("now"), size: 11, tracking: 2)
            Spacer()
            Text(now.leftText).font(Theme.body(12)).foregroundStyle(Color.glIvorySoft)
          }
          Text(now.title).font(Theme.display(32)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.6)
          Text(now.line).font(Theme.body(13)).foregroundStyle(Color.glIvorySoft).lineLimit(1)
          if let f = now.fraction {
            ProgressBar(fraction: f, height: 4, track: .glTrackNavy).padding(.top, sc(5))
          }
        }
        .padding(.horizontal, sc(12)).padding(.top, sc(11)).padding(.bottom, sc(12))
        .frame(maxWidth: .infinity, alignment: .leading).card(highlight: true, radius: 17)
        .accessibilityElement(children: .combine)
        nextRows(d?.next ?? [])
      } else if let first = d?.next.first {
        VStack(alignment: .leading, spacing: sc(3)) {
          CapsLabel(text: L10n.t("next"))
          Text(first.title).font(Theme.display(32)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.6)
          Text(first.time).font(Theme.body(13)).foregroundStyle(Color.glIvorySoft)
        }
        .padding(.horizontal, sc(12)).padding(.vertical, sc(11))
        .frame(maxWidth: .infinity, alignment: .leading).card(highlight: true, radius: 17)
        nextRows(Array((d?.next ?? []).dropFirst()))
      }
    }
  }

  private func nextRows(_ rows: [Snapshot.DayOf.Next]) -> some View {
    VStack(spacing: sc(4)) {
      ForEach(rows.prefix(2)) { n in
        HStack(spacing: sc(8)) {
          Text(n.time).font(Theme.bodySemibold(13)).foregroundStyle(Color.glGold).lineLimit(1).fixedSize(horizontal: true, vertical: false).frame(minWidth: sc(36), alignment: .leading)
          Text(n.title).font(Theme.body(14)).foregroundStyle(Color.glIvory).lineLimit(1)
          Spacer(minLength: 0)
        }
        .padding(.horizontal, sc(12)).frame(height: sc(32)).card(radius: 12)
        .accessibilityElement(children: .combine)
      }
    }
  }
}
