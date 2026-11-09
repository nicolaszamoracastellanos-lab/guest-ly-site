import SwiftUI

// VendorArrivals.dc.html
struct VendorArrivalsView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let v = store.snapshot.vendorsToday
    ScreenFrame(title: L10n.t("vendors"), trailing: v?.summary) {
      VStack(spacing: sc(5)) {
        ForEach((v?.items ?? []).prefix(3)) { item in row(item) }
      }
    }
  }

  @ViewBuilder
  private func row(_ item: Snapshot.VendorsToday.Item) -> some View {
    let late = item.state == "late"
    let onsite = item.state == "onsite"
    HStack(spacing: sc(8)) {
      Button {
        if !onsite { Task { await store.run("vendor.onsite", ["blockId": item.blockId]) } }
      } label: {
        ZStack {
          if onsite {
            Circle().fill(Color.glGold)
            GlyphView(paths: [Glyph.check], size: sc(12), color: .glInk, line: 2.6)
          } else {
            Circle().strokeBorder(late ? Color.glIvory : Color.glGold, lineWidth: sc(1.5))
          }
        }
        .frame(width: sc(22), height: sc(22))
      }
      .buttonStyle(.plain)
      .accessibilityLabel(onsite ? "\(item.name), on site" : "Mark \(item.name) on site")
      VStack(alignment: .leading, spacing: sc(1)) {
        Text(item.name).font(Theme.body(14)).foregroundStyle(Color.glIvory).lineLimit(1)
        Text(item.note).font(late ? Theme.bodySemibold(11) : Theme.body(11)).foregroundStyle(late ? Color.glIvory : Color.glMuted).lineLimit(1)
      }
      Spacer(minLength: 0)
      if late, let tel = item.tel, let url = URL(string: "tel:\(tel)") {
        Button { WatchURL.open(url) } label: { CallCircle(primary: true) }
          .buttonStyle(.plain).accessibilityLabel("Call \(item.name)")
      }
    }
    .padding(.horizontal, sc(10)).frame(height: sc(late ? 58 : 48)).card(highlight: late)
  }
}
