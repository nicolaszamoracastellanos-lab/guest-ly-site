import Foundation
import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

let glGroup = "group.com.zcventures.guestly"
let glSnapshotKey = "gl.watch.snapshot"

/// The watch's only link to the world: the iPhone. Holds the latest snapshot and
/// sends actions. No tokens, no API.
@MainActor
final class WatchStore: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchStore()

  @Published var snapshot: Snapshot = Snapshot(enabled: false)
  @Published var hasSnapshot = false
  @Published var requestedPage: String?
  @Published var showPhoneNeeded = false
  @Published var toast: String?

  private var demo = false

  override init() {
    super.init()
    #if DEBUG
    if let kind = DemoLoader.requestedDemo() {
      demo = true
      snapshot = DemoLoader.load(kind)
      hasSnapshot = true
      requestedPage = UserDefaults.standard.string(forKey: "glDemoPage")
      return
    }
    #endif
    if let raw = UserDefaults(suiteName: glGroup)?.string(forKey: glSnapshotKey), let s = Self.decode(raw) {
      snapshot = s
      hasSnapshot = true
      L10n.lang = s.lang
    }
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
    if let raw = session.receivedApplicationContext["snapshot"] as? String { apply(raw) }
  }

  nonisolated static func decode(_ raw: String) -> Snapshot? {
    guard let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(Snapshot.self, from: data)
  }

  func apply(_ raw: String) {
    guard let s = Self.decode(raw) else { return }
    snapshot = s
    hasSnapshot = true
    L10n.lang = s.lang
    UserDefaults(suiteName: glGroup)?.set(raw, forKey: glSnapshotKey)
    WidgetCenter.shared.reloadAllTimelines()
  }

  // MARK: actions

  /// Sends one action to the phone and waits for its answer.
  func send(_ type: String, _ payload: [String: Any] = [:]) async -> ActionResult {
    #if DEBUG
    if demo { return await DemoLoader.act(type, payload, store: self) }
    #endif
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else { return .phoneNeeded }
    let body = (try? JSONSerialization.data(withJSONObject: payload)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    let message: [String: Any] = ["id": UUID().uuidString, "type": type, "payload": body]
    return await withCheckedContinuation { cont in
      var done = false
      let finish: (ActionResult) -> Void = { r in
        DispatchQueue.main.async {
          if done { return }
          done = true
          cont.resume(returning: r)
        }
      }
      session.sendMessage(message, replyHandler: { reply in
        guard let json = reply["json"] as? String,
              let data = json.data(using: .utf8),
              let r = try? JSONDecoder().decode(ActionReply.self, from: data) else { finish(.failure("")); return }
        finish(r.ok ? .success(r) : .failure(r.error ?? ""))
      }, errorHandler: { _ in finish(.phoneNeeded) })
      DispatchQueue.main.asyncAfter(deadline: .now() + 25) { finish(.phoneNeeded) }
    }
  }

  /// Runs an action with the feedback every action shares: success haptic,
  /// failure haptic and a short toast, or the "open your iPhone" sheet. Returns
  /// the reply on success, nil otherwise.
  @discardableResult
  func run(_ type: String, _ payload: [String: Any] = [:]) async -> ActionReply? {
    switch await send(type, payload) {
    case .success(let r):
      WKInterfaceDevice.current().play(.success)
      return r
    case .failure(let msg):
      WKInterfaceDevice.current().play(.failure)
      toast = msg.isEmpty ? L10n.t("failed") : msg
      Task { try? await Task.sleep(nanoseconds: 2_500_000_000); self.toast = nil }
      return nil
    case .phoneNeeded:
      WKInterfaceDevice.current().play(.failure)
      showPhoneNeeded = true
      return nil
    }
  }

  // MARK: WCSessionDelegate

  nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if let raw = session.receivedApplicationContext["snapshot"] as? String {
      Task { @MainActor in self.apply(raw) }
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    if let raw = applicationContext["snapshot"] as? String {
      Task { @MainActor in self.apply(raw) }
    }
  }
}
