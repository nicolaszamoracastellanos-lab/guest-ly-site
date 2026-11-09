import SwiftUI

// RunningLate.dc.html
struct RunningLateView: View {
  @EnvironmentObject var store: WatchStore
  @Binding var dismissedBlock: String?

  var body: some View {
    let o = store.snapshot.dayOf?.overrun
    VStack(alignment: .leading, spacing: sc(6)) {
      Text(L10n.t("runSheet")).font(Theme.bodyMedium(15)).foregroundStyle(Color.glGold)
        .padding(.leading, sc(6)).frame(height: sc(20), alignment: .leading)
      VStack(alignment: .leading, spacing: sc(4)) {
        Text(o?.question ?? "").font(Theme.display(25)).foregroundStyle(Color.glIvory)
        Text(o?.body ?? "").font(Theme.body(12)).foregroundStyle(Color.glIvorySoft).lineSpacing(1)
      }
      .padding(.horizontal, sc(6))
      Spacer(minLength: 0)
      VStack(spacing: sc(5)) {
        PrimaryButton(title: o?.pushLabel ?? "") {
          guard let o else { return }
          Task {
            if await store.run("runsheet.push15", ["blockId": o.blockId]) != nil { dismissedBlock = o.blockId }
          }
        }
        SecondaryButton(title: o?.keepLabel ?? "") { dismissedBlock = o?.blockId }
      }
    }
    .padding(.horizontal, sc(12)).padding(.top, sc(15)).padding(.bottom, sc(13))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color.glBlack.ignoresSafeArea())
  }
}
