import SwiftUI

/// The Coordinator conversation on the wrist: idle (Ask.dc.html), waiting, and
/// answered (Answer.dc.html). State is local; the phone keeps the real session.
struct AskView: View {
  @EnvironmentObject var store: WatchStore
  @State private var phase: Phase = .idle

  enum Phase: Equatable {
    case idle
    case waiting(String)
    case answered(q: String, text: String, actionId: String?, confirmLabel: String?)
  }

  var body: some View {
    switch phase {
    case .idle: idle
    case .waiting(let q): waiting(q)
    case .answered(let q, let text, let actionId, let label): answered(q, text, actionId, label)
    }
  }

  private var suggestions: [String] {
    store.snapshot.role == "planner"
      ? [L10n.t("askSuggestPlannerA"), L10n.t("askSuggestPlannerB")]
      : [L10n.t("askSuggestCoupleA"), L10n.t("askSuggestCoupleB")]
  }

  private var idle: some View {
    ScreenFrame(title: L10n.t("coordinator"), gap: 6) {
      VStack(spacing: sc(4)) {
        TextFieldLink(prompt: Text(L10n.t("coordinator"))) {
          Circle().fill(Color.glGold).frame(width: sc(64), height: sc(64)).overlay(MicGlyph(size: 28, color: .glInk, line: 1.8))
        } onSubmit: { ask($0) }
          .buttonStyle(.plain).accessibilityLabel(L10n.t("tapAsk"))
        Text(L10n.t("tapAsk")).font(Theme.body(12)).foregroundStyle(Color.glIvorySoft).lineLimit(1).minimumScaleFactor(0.7)
      }
      .frame(maxWidth: .infinity)
      Spacer(minLength: 0)
      VStack(spacing: sc(5)) {
        ForEach(suggestions, id: \.self) { s in
          Button { ask(s) } label: {
            Text(s).font(Theme.body(13)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.7)
              .padding(.horizontal, sc(12)).frame(maxWidth: .infinity, alignment: .leading).frame(height: sc(38))
              .background(Capsule().fill(Color.glNavy))
          }.buttonStyle(.plain)
        }
      }
    }
  }

  private func waiting(_ q: String) -> some View {
    ScreenFrame(title: L10n.t("coordinator"), gap: 6) {
      Text(q).font(Theme.body(12)).foregroundStyle(Color.glMuted).padding(.horizontal, sc(6))
      Gem(size: 10).modifier(Pulse()).padding(.leading, sc(10)).padding(.top, sc(8))
      Spacer(minLength: 0)
    }
  }

  private func answered(_ q: String, _ text: String, _ actionId: String?, _ label: String?) -> some View {
    ScreenFrame(title: L10n.t("coordinator"), gap: 6) {
      ScrollView {
        VStack(alignment: .leading, spacing: sc(4)) {
          Text(q).font(Theme.body(12)).foregroundStyle(Color.glMuted)
          Text(text).font(Theme.body(14)).foregroundStyle(Color.glIvory).lineSpacing(2)
        }
        .padding(.horizontal, sc(6)).frame(maxWidth: .infinity, alignment: .leading)
      }
      VStack(spacing: sc(5)) {
        if let actionId, let label {
          PrimaryButton(title: label) { confirm(actionId, q) }
        }
        TextFieldLink(prompt: Text(L10n.t("askMore"))) {
          HStack(spacing: sc(6)) {
            MicGlyph(size: 15)
            Text(L10n.t("askMore")).font(Theme.bodyMedium(15)).foregroundStyle(Color.glIvory).lineLimit(1)
          }
          .frame(maxWidth: .infinity).frame(height: sc(44)).background(Capsule().fill(Color.glButtonDark))
        } onSubmit: { ask($0) }
          .buttonStyle(.plain)
      }
    }
  }

  private func ask(_ text: String) {
    let q = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !q.isEmpty else { return }
    phase = .waiting(q)
    Task {
      if let r = await store.run("coordinator.ask", ["text": q]) {
        let reply = r.data?["text"]?.value as? String ?? ""
        let card = r.data?["card"]?.value as? [String: Any]
        phase = .answered(q: q, text: reply, actionId: card?["actionId"] as? String, confirmLabel: card?["confirmLabel"] as? String)
      } else {
        phase = .idle
      }
    }
  }

  private func confirm(_ actionId: String, _ q: String) {
    phase = .waiting(q)
    Task {
      if let r = await store.run("coordinator.confirm", ["actionId": actionId]) {
        phase = .answered(q: q, text: r.data?["text"]?.value as? String ?? "", actionId: nil, confirmLabel: nil)
      } else {
        phase = .idle
      }
    }
  }
}
