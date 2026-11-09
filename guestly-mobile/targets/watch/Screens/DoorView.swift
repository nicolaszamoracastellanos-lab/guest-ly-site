import SwiftUI

// Door.dc.html
struct DoorView: View {
  @EnvironmentObject var store: WatchStore
  @State private var results: [GuestResult] = []
  @State private var showResults = false
  @State private var searching = false

  var body: some View {
    let d = store.snapshot.door
    let frac = (d?.total ?? 0) > 0 ? Double(d?.inCount ?? 0) / Double(d?.total ?? 1) : 0
    VStack(spacing: sc(5)) {
      HStack { Text(L10n.t("door")).font(Theme.bodyMedium(15)).foregroundStyle(Color.glGold); Spacer() }
        .padding(.leading, sc(6)).frame(height: sc(20))
      ZStack {
        RingProgress(fraction: frac, lineWidth: 8)
        VStack(spacing: 0) {
          Text("\(d?.inCount ?? 0)").font(Theme.display(46)).foregroundStyle(Color.glIvory).frame(height: sc(38))
          Text(L10n.f("ofHere", d?.total ?? 0)).font(Theme.body(12)).foregroundStyle(Color.glMuted).lineLimit(1).minimumScaleFactor(0.7)
        }
      }
      .frame(width: sc(104), height: sc(104))
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("\(d?.inCount ?? 0) \(L10n.f("ofHere", d?.total ?? 0))")
      if let last = d?.lastText {
        Text(last).font(Theme.body(12)).foregroundStyle(Color.glIvorySoft).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.8)
      }
      Spacer(minLength: 0)
      TextFieldLink(prompt: Text(L10n.t("findGuest"))) {
        HStack(spacing: sc(6)) {
          MicGlyph(size: 15, color: .glInk)
          Text(L10n.t("findGuest")).font(Theme.bodySemibold(15)).foregroundStyle(Color.glInk).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity).frame(height: sc(44)).background(Capsule().fill(Color.glGold))
      } onSubmit: { text in
        Task { await search(text) }
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, sc(12)).padding(.top, sc(15)).padding(.bottom, sc(13))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.glBlack.ignoresSafeArea())
    .sheet(isPresented: $showResults) {
      FindGuestSheet(results: $results, searching: searching)
    }
  }

  private func search(_ q: String) async {
    searching = true; results = []; showResults = true
    let r = await store.run("checkin.search", ["q": q])
    searching = false
    if let arr = r?.data?["results"]?.value as? [[String: Any]] {
      results = arr.compactMap { GuestResult(dict: $0) }
    } else if r == nil { showResults = false }
  }
}
