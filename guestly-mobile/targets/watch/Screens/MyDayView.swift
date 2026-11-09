import SwiftUI

// MyDay.dc.html
struct MyDayView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    ScreenFrame(title: L10n.t("yourDay"), gap: 6) {
      Text(store.snapshot.wedding?.names ?? "").font(Theme.displayItalic(20)).foregroundStyle(Color.glIvory)
        .padding(.horizontal, sc(6)).lineLimit(1).minimumScaleFactor(0.6)
      VStack(spacing: sc(4)) {
        ForEach((store.snapshot.myDay ?? []).prefix(3)) { e in
          HStack(spacing: sc(8)) {
            Text(e.time).font(Theme.bodySemibold(14)).foregroundStyle(e.soon ? Color.glGoldLight : Color.glGold).lineLimit(1).fixedSize(horizontal: true, vertical: false).frame(minWidth: sc(37), alignment: .leading)
            VStack(alignment: .leading, spacing: sc(1)) {
              Text(e.title).font(Theme.body(14)).foregroundStyle(Color.glIvory).lineLimit(1)
              Text(e.note).font(Theme.body(11)).foregroundStyle(e.soon ? Color.glIvorySoft : Color.glMuted).lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
          }
          .padding(.horizontal, sc(12)).frame(height: sc(50)).card(highlight: e.soon)
          .accessibilityElement(children: .combine)
        }
      }
      .padding(.top, sc(2))
    }
  }
}
