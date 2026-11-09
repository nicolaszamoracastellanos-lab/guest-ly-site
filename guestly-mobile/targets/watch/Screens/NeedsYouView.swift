import SwiftUI

// NeedsYou.dc.html
struct NeedsYouView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let item = store.snapshot.needsYou?.first
    VStack(alignment: .leading, spacing: sc(7)) {
      HStack(spacing: sc(7)) {
        GemBadge()
        CapsLabel(text: L10n.t("needsYou"), size: 12, color: .glGold, tracking: 1.5)
      }
      .padding(.leading, sc(6))
      VStack(alignment: .leading, spacing: sc(3)) {
        Text(item?.from ?? "").font(Theme.body(12)).foregroundStyle(Color.glMuted)
        Text(item?.question ?? "").font(Theme.display(21)).foregroundStyle(Color.glIvory).lineSpacing(1)
          .lineLimit(4).minimumScaleFactor(0.7)
      }
      .padding(.horizontal, sc(6))
      Spacer(minLength: 0)
      if let item {
        if item.canReply {
          VStack(spacing: sc(5)) {
            HStack(spacing: sc(5)) {
              PrimaryButton(title: L10n.t("yes")) { reply(item, L10n.t("quickYes")) }
              SecondaryButton(title: L10n.t("no")) { reply(item, L10n.t("quickNo")) }
            }
            TextFieldLink(prompt: Text(L10n.t("answerVoice"))) {
              HStack(spacing: sc(6)) {
                MicGlyph(size: 15)
                Text(L10n.t("answerVoice")).font(Theme.bodyMedium(14)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.8)
              }
              .frame(maxWidth: .infinity).frame(height: sc(44)).background(Capsule().fill(Color.glButtonDark))
            } onSubmit: { reply(item, $0) }
              .buttonStyle(.plain)
          }
        } else {
          SecondaryButton(title: L10n.t("answerOnPhone")) {}
        }
      }
    }
    .padding(.horizontal, sc(12)).padding(.top, sc(17)).padding(.bottom, sc(13))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color.glBlack.ignoresSafeArea())
  }

  private func reply(_ item: Snapshot.NeedsYouItem, _ text: String) {
    Task {
      if await store.run("needsYou.reply", ["id": item.id, "text": text]) != nil {
        store.snapshot.needsYou?.removeAll { $0.id == item.id }
      }
    }
  }
}
