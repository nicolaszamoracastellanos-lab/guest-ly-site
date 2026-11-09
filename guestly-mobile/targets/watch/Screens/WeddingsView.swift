import SwiftUI

// Weddings.dc.html
struct WeddingsView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    ScreenFrame(title: L10n.t("weddings")) {
      VStack(spacing: sc(5)) {
        ForEach((store.snapshot.weddings ?? []).prefix(3)) { w in
          VStack(alignment: .leading, spacing: sc(1)) {
            Text(w.label).font(Theme.bodySemibold(10)).tracking(1.5 * Theme.s).textCase(.uppercase)
              .foregroundStyle(w.today ? Color.glGoldLight : Color.glMuted)
            Text(w.names).font(Theme.displayItalic(18)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.6)
            Text(w.line).font(Theme.body(11)).foregroundStyle(w.today ? Color.glIvorySoft : Color.glMuted).lineLimit(1)
          }
          .padding(.horizontal, sc(12)).frame(maxWidth: .infinity, minHeight: sc(58), alignment: .leading).card(highlight: w.today)
          .accessibilityElement(children: .combine)
        }
      }
    }
  }
}
