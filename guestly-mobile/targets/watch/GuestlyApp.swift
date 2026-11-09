import SwiftUI

@main
struct GuestlyApp: App {
  @StateObject private var store = WatchStore.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(store)
        .onOpenURL { url in
          // guestly-watch://page/{name}
          if url.scheme == "guestly-watch", url.host == "page" {
            store.requestedPage = url.lastPathComponent
          }
        }
    }
  }
}
