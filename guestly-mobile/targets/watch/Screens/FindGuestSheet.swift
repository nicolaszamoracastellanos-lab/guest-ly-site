import SwiftUI

struct GuestResult: Identifiable, Equatable {
  let guestId: String
  let name: String
  let line: String
  var already: Bool
  var id: String { guestId }
  init?(dict: [String: Any]) {
    guard let g = dict["guestId"] as? String, let n = dict["name"] as? String else { return nil }
    guestId = g; name = n; line = (dict["line"] as? String) ?? ""; already = (dict["already"] as? Bool) ?? false
  }
}

/// FindGuestFlow: results of the dictated name, tap = check in.
struct FindGuestSheet: View {
  @EnvironmentObject var store: WatchStore
  @Environment(\.dismiss) private var dismiss
  @Binding var results: [GuestResult]
  let searching: Bool
  @State private var confirmed: String?

  var body: some View {
    ZStack {
      Color.glBlack.ignoresSafeArea()
      if let confirmed {
        VStack(spacing: sc(8)) {
          ZStack { Circle().fill(Color.glGold); GlyphView(paths: [Glyph.check], size: sc(26), color: .glInk, line: 2.6) }
            .frame(width: sc(48), height: sc(48))
          Text(confirmed).font(Theme.display(22)).foregroundStyle(Color.glIvory).multilineTextAlignment(.center)
        }
      } else if searching {
        Gem(size: 10).modifier(Pulse())
      } else if results.isEmpty {
        Text(L10n.t("noResults")).font(Theme.body(14)).foregroundStyle(Color.glMuted)
      } else {
        ScrollView {
          VStack(spacing: sc(5)) {
            ForEach(results.prefix(5)) { g in
              Button { Task { await commit(g) } } label: {
                HStack(spacing: sc(8)) {
                  VStack(alignment: .leading, spacing: sc(1)) {
                    Text(g.name).font(Theme.body(14)).foregroundStyle(Color.glIvory).lineLimit(1)
                    Text(g.line).font(Theme.body(11)).foregroundStyle(Color.glMuted).lineLimit(1)
                  }
                  Spacer(minLength: 0)
                  if g.already { CheckCircle(done: true, size: 20) }
                }
                .padding(.horizontal, sc(10)).frame(height: sc(48)).card()
              }
              .buttonStyle(.plain)
            }
          }
          .padding(.horizontal, sc(8))
        }
      }
    }
  }

  private func commit(_ g: GuestResult) async {
    if g.already { confirmed = L10n.t("alreadyIn"); await close(); return }
    if await store.run("checkin.commit", ["guestId": g.guestId]) != nil {
      confirmed = L10n.f("isIn", g.name)
      await close()
    }
  }

  private func close() async {
    try? await Task.sleep(nanoseconds: 1_500_000_000)
    dismiss()
  }
}

/// Soft pulse (opacity 0.4 to 1, 1.2 s) used while a reply is on its way.
struct Pulse: ViewModifier {
  @State private var on = false
  func body(content: Content) -> some View {
    content.opacity(on ? 1 : 0.4).onAppear { withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { on = true } }
  }
}
