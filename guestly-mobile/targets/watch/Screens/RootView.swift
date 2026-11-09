import SwiftUI
import WatchKit

enum WatchURL {
  static func open(_ url: URL) { WKExtension.shared().openSystemURL(url) }
}

struct RootView: View {
  @EnvironmentObject var store: WatchStore
  @State private var page: String = ""
  @State private var dismissedLate: String?

  /// The pages for this snapshot, in order, skipping sections that are null.
  private var pages: [String] {
    let s = store.snapshot
    guard store.hasSnapshot, s.enabled, s.role != "none" else { return [] }
    let dayOf = s.wedding?.isDayOf ?? false
    var p: [String] = []
    switch s.role {
    case "couple":
      let needs = !(s.needsYou ?? []).isEmpty
      let late = s.dayOf?.overrun != nil && s.dayOf?.overrun?.blockId != dismissedLate
      if dayOf {
        if late { p.append("runninglate") }
        if s.dayOf != nil { p.append("nownext") }
        if s.door != nil { p.append("door") }
        if s.vendorsToday != nil { p.append("vendors") }
        if needs { p.append("needsyou") }
        p.append("ask")
        if s.wedding != nil { p.append("countdown") }
      } else {
        if s.wedding != nil { p.append("countdown") }
        if needs { p.append("needsyou") }
        if s.replies != nil { p.append("replies") }
        if s.tasks != nil { p.append("today") }
        if s.budget != nil { p.append("budget") }
        if !(s.team ?? []).isEmpty { p.append("team") }
        p.append("ask")
      }
    case "planner":
      if dayOf {
        if s.dayOf != nil { p.append("nownext") }
        if s.door != nil { p.append("door") }
        if s.vendorsToday != nil { p.append("vendors") }
        if !(s.weddings ?? []).isEmpty { p.append("weddings") }
      } else {
        if !(s.weddings ?? []).isEmpty { p.append("weddings") }
        if s.tasks != nil { p.append("today") }
      }
      p.append("ask")
    case "guest":
      if s.pass != nil { p.append("pass") }
      if !(s.myDay ?? []).isEmpty { p.append("myday") }
      if s.wedding != nil { p.append("countdown") }
    default: break
    }
    return p
  }

  var body: some View {
    let list = pages
    Group {
      if list.isEmpty {
        PhoneNeededView().ignoresSafeArea(edges: .top)
      } else {
        TabView(selection: $page) {
          ForEach(list, id: \.self) { name in
            content(name).ignoresSafeArea(edges: .top).tag(name)
          }
        }
        .tabViewStyle(.verticalPage)
        .onAppear {
          if let req = store.requestedPage, list.contains(req) { page = req; store.requestedPage = nil }
          else if !list.contains(page) { page = list[0] }
        }
        .onChange(of: list) { _, new in if !new.contains(page) { page = new.first ?? "" } }
        .onChange(of: store.requestedPage) { _, req in
          if let req, list.contains(req) { page = req }
          store.requestedPage = nil
        }
      }
    }
    .sheet(isPresented: $store.showPhoneNeeded) { PhoneNeededSheet() }
    .overlay(alignment: .bottom) {
      if let t = store.toast {
        Text(t).font(Theme.bodyMedium(12)).foregroundStyle(Color.glIvory).padding(.horizontal, sc(10)).padding(.vertical, sc(6))
          .background(Capsule().fill(Color.glNavy)).padding(.bottom, sc(8)).transition(.opacity)
      }
    }
    .animation(.easeInOut(duration: 0.2), value: store.toast)
  }

  @ViewBuilder
  private func content(_ name: String) -> some View {
    switch name {
    case "countdown": CountdownView()
    case "replies": RepliesView()
    case "today": TodayView()
    case "budget": BudgetView()
    case "team": TeamView()
    case "nownext": NowNextView()
    case "door": DoorView()
    case "vendors": VendorArrivalsView()
    case "runninglate": RunningLateView(dismissedBlock: $dismissedLate)
    case "weddings": WeddingsView()
    case "needsyou": NeedsYouView()
    case "ask": AskView()
    case "pass": PassView()
    case "myday": MyDayView()
    default: PhoneNeededView()
    }
  }
}

/// Shown when there is no snapshot, the role is none, or the feature is off.
struct PhoneNeededView: View {
  var body: some View {
    VStack(spacing: sc(8)) {
      GemBadge()
      Text(L10n.t("openPhone")).font(Theme.display(25)).foregroundStyle(Color.glIvory).multilineTextAlignment(.center)
      Text(L10n.t("updatesFromApp")).font(Theme.body(12)).foregroundStyle(Color.glMuted).multilineTextAlignment(.center)
    }
    .padding(.horizontal, sc(14))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.glBlack.ignoresSafeArea())
  }
}

/// Sheet shown when an action needs the phone and it is out of reach.
struct PhoneNeededSheet: View {
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    VStack(spacing: sc(10)) {
      Text(L10n.t("openPhone")).font(Theme.display(22)).foregroundStyle(Color.glIvory).multilineTextAlignment(.center)
      SecondaryButton(title: L10n.t("ok")) { dismiss() }
    }
    .padding(.horizontal, sc(12))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.glBlack.ignoresSafeArea())
  }
}
