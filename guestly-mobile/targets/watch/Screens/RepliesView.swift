import SwiftUI

// Replies.dc.html
struct RepliesView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let r = store.snapshot.replies
    ScreenFrame(title: L10n.t("replies")) {
      HStack(alignment: .firstTextBaseline, spacing: sc(6)) {
        Text("\(r?.going ?? 0)").font(Theme.display(52)).tracking(-1 * Theme.s).foregroundStyle(Color.glIvory)
        Text(L10n.f("ofComing", r?.total ?? 0)).font(Theme.body(13)).foregroundStyle(Color.glMuted).lineLimit(1).minimumScaleFactor(0.7)
      }
      .padding(.horizontal, sc(6)).frame(height: sc(44), alignment: .bottom)
      SegmentBar(parts: [(r?.going ?? 0, .glGold), (r?.pending ?? 0, .glIvory), (r?.declined ?? 0, .glDeclined)])
        .frame(height: sc(6)).padding(.horizontal, sc(6)).padding(.top, sc(3))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(r?.going ?? 0) / \(r?.pending ?? 0) / \(r?.declined ?? 0)")
      VStack(spacing: sc(4)) {
        row(L10n.t("confirmed"), r?.going ?? 0, .glGold)
        row(L10n.t("pending"), r?.pending ?? 0, .glIvory)
        row(L10n.t("declined"), r?.declined ?? 0, .glDeclined)
      }
      .padding(.top, sc(3))
    }
  }

  private func row(_ label: String, _ n: Int, _ dot: Color) -> some View {
    HStack(spacing: sc(7)) {
      Circle().fill(dot).frame(width: sc(7), height: sc(7))
      Text(label).font(Theme.body(14)).foregroundStyle(Color.glIvory).frame(maxWidth: .infinity, alignment: .leading)
      Text("\(n)").font(Theme.bodySemibold(14)).foregroundStyle(Color.glIvory)
    }
    .padding(.horizontal, sc(10)).frame(height: sc(30)).card(radius: 11)
    .accessibilityElement(children: .combine)
  }
}
