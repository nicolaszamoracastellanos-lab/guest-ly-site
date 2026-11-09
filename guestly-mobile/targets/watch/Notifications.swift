import SwiftUI
import UserNotifications
import WatchKit

// Custom notification looks for the two categories the phone registers
// (gl.rsvp_new, gl.escalation). iPhone pushes already mirror to the watch with
// the system look; when the push carries one of these categories the watch draws
// these instead (ReplyAlert.dc.html and the Needs you header). The tap opens the
// matching page. There is no "Send thanks" and no arrival look: those need
// server features that do not exist.

struct AlertContent: View {
  let kind: String          // header label
  let title: String
  let message: String

  var body: some View {
    VStack(alignment: .leading, spacing: sc(7)) {
      HStack(spacing: sc(7)) {
        GemBadge()
        CapsLabel(text: kind, size: 12, color: .glGold, tracking: 1.5)
      }
      VStack(alignment: .leading, spacing: sc(3)) {
        Text(title).font(Theme.display(25)).foregroundStyle(Color.glIvory).lineLimit(3).minimumScaleFactor(0.7)
        if !message.isEmpty {
          Text(message).font(Theme.body(13)).foregroundStyle(Color.glIvorySoft).lineLimit(4)
        }
      }
      .padding(.horizontal, sc(2))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(sc(4))
  }
}

final class RsvpNotificationController: WKUserNotificationHostingController<AlertContent> {
  private var alertTitle = ""
  private var alertMessage = ""
  override var body: AlertContent { AlertContent(kind: L10n.t("newReply"), title: alertTitle, message: alertMessage) }
  override func didReceive(_ notification: UNNotification) {
    alertTitle = notification.request.content.title
    alertMessage = notification.request.content.body
  }
}

final class EscalationNotificationController: WKUserNotificationHostingController<AlertContent> {
  private var alertTitle = ""
  private var alertMessage = ""
  override var body: AlertContent { AlertContent(kind: L10n.t("needsYou"), title: alertTitle, message: alertMessage) }
  override func didReceive(_ notification: UNNotification) {
    alertTitle = notification.request.content.title
    alertMessage = notification.request.content.body
  }
}

/// A tap on a notification opens the page that matches its category.
final class NotificationRouter: NSObject, UNUserNotificationCenterDelegate {
  static let shared = NotificationRouter()

  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let page: String?
    switch response.notification.request.content.categoryIdentifier {
    case "gl.rsvp_new": page = "replies"
    case "gl.escalation": page = "needsyou"
    default: page = nil
    }
    if let page { Task { @MainActor in WatchStore.shared.requestedPage = page } }
    completionHandler()
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .sound])
  }
}
