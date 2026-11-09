import SwiftUI

// Team.dc.html
struct TeamView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    ScreenFrame(title: L10n.t("yourTeam")) {
      VStack(spacing: sc(5)) {
        ForEach(Array((store.snapshot.team ?? []).prefix(3).enumerated()), id: \.element.id) { i, m in
          Button {
            if let url = URL(string: "tel:\(m.tel)") { WatchURL.open(url) }
          } label: {
            HStack(spacing: sc(8)) {
              VStack(alignment: .leading, spacing: sc(1)) {
                Text(m.name).font(Theme.body(15)).foregroundStyle(Color.glIvory).lineLimit(1)
                Text(m.note).font(Theme.body(11)).foregroundStyle(i == 0 ? Color.glIvorySoft : Color.glMuted).lineLimit(1)
              }
              Spacer(minLength: 0)
              CallCircle(primary: i == 0)
            }
            .padding(.leading, sc(12)).padding(.trailing, sc(10)).frame(height: sc(58)).card(highlight: i == 0)
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Call \(m.name)")
        }
      }
    }
  }
}
