import SwiftUI

// Budget.dc.html
struct BudgetView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let b = store.snapshot.budget
    ScreenFrame(title: L10n.t("budget")) {
      VStack(alignment: .leading, spacing: sc(2)) {
        Text(b?.paidText ?? "").font(Theme.display(46)).tracking(-1 * Theme.s).foregroundStyle(Color.glIvory)
          .lineLimit(1).minimumScaleFactor(0.5).frame(height: sc(40), alignment: .bottom)
        Text(L10n.f("paidOf", b?.totalText ?? "")).font(Theme.body(13)).foregroundStyle(Color.glMuted).lineLimit(1)
      }
      .padding(.horizontal, sc(6))
      ProgressBar(fraction: b?.fraction ?? 0, height: 6).padding(.horizontal, sc(6))
      Spacer(minLength: 0)
      if let n = b?.next {
        VStack(alignment: .leading, spacing: sc(2)) {
          CapsLabel(text: L10n.t("nextPayment"))
          HStack(alignment: .firstTextBaseline) {
            Text(n.name).font(Theme.body(15)).foregroundStyle(Color.glIvory).lineLimit(1)
            Spacer(minLength: sc(6))
            Text(n.amountText).font(Theme.bodySemibold(15)).foregroundStyle(Color.glIvory).lineLimit(1)
          }
          Text(n.dueText).font(Theme.body(12)).foregroundStyle(Color.glIvorySoft)
        }
        .padding(.horizontal, sc(12)).padding(.top, sc(10)).padding(.bottom, sc(11))
        .frame(maxWidth: .infinity, alignment: .leading).card(highlight: true, radius: 15)
        .accessibilityElement(children: .combine)
      }
    }
  }
}
