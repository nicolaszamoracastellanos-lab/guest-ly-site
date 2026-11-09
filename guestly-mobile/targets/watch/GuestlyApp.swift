import SwiftUI
import UserNotifications
import WatchKit

@main
struct GuestlyApp: App {
  @StateObject private var store = WatchStore.shared

  init() {
    UNUserNotificationCenter.current().delegate = NotificationRouter.shared
  }

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
    WKNotificationScene(controller: RsvpNotificationController.self, category: "gl.rsvp_new")
    WKNotificationScene(controller: EscalationNotificationController.self, category: "gl.escalation")
  }
}
