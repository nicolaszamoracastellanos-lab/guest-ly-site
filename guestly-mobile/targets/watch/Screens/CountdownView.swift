import SwiftUI

// Main.dc.html
struct CountdownView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let w = store.snapshot.wedding
    VStack(spacing: 0) {
      HStack { Wordmark(); Spacer() }
        .padding(.leading, sc(6)).frame(height: sc(20))
      Spacer(minLength: 0)
      VStack(spacing: sc(2)) {
        if let w, !w.passed {
          Text("\(w.days)")
            .font(Theme.display(92)).tracking(-2 * Theme.s).foregroundStyle(Color.glIvory)
            .frame(height: sc(75)).minimumScaleFactor(0.5).lineLimit(1)
          Text(L10n.t("daysToGo")).font(Theme.bodyMedium(12)).tracking(2.5 * Theme.s).textCase(.uppercase)
            .foregroundStyle(Color.glGold).padding(.top, sc(7)).lineLimit(1).minimumScaleFactor(0.7)
        } else {
          Text(L10n.t("justMarried")).font(Theme.display(34)).foregroundStyle(Color.glIvory).multilineTextAlignment(.center)
        }
      }
      Spacer(minLength: 0)
      VStack(spacing: sc(1)) {
        Rectangle().fill(Color.glGold).frame(width: sc(28), height: 0.5).padding(.bottom, sc(6))
        Text(w?.names ?? "").font(Theme.displayItalic(21)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.6)
        Text(w?.dateText ?? "").font(Theme.body(12)).foregroundStyle(Color.glMuted)
      }
    }
    .padding(.horizontal, sc(12)).padding(.top, sc(15)).padding(.bottom, sc(14))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.glBlack.ignoresSafeArea())
  }
}
