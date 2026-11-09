// The phone side of WatchConnectivity. One singleton, activated at app launch
// by GuestlyWatchSubscriber, because the watch can wake the phone in the
// background before any JavaScript runs. Messages that arrive before JS has a
// listener are queued and flushed when the first listener attaches.

import ExpoModulesCore
import Foundation
import WatchConnectivity

struct WatchAction {
  let id: String
  let type: String
  let payload: String
}

final class WatchSession: NSObject, WCSessionDelegate {
  static let shared = WatchSession()

  private let lock = NSLock()
  private var handlers: [String: ([String: Any]) -> Void] = [:]
  private var queue: [WatchAction] = []
  private var listener: ((WatchAction) -> Void)?

  private var session: WCSession? { WCSession.isSupported() ? WCSession.default : nil }

  func activate() {
    guard let session else { return }
    session.delegate = self
    if session.activationState != .activated { session.activate() }
  }

  func state() -> [String: Bool] {
    guard let session else { return ["paired": false, "installed": false, "reachable": false] }
    return [
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
      "reachable": session.isReachable,
    ]
  }

  /// Latest-wins. Never throws: a phone without a paired watch just skips.
  func setSnapshot(_ json: String) {
    guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
    try? session.updateApplicationContext(["snapshot": json])
  }

  func attach(_ cb: @escaping (WatchAction) -> Void) {
    lock.lock()
    listener = cb
    let pending = queue
    queue = []
    lock.unlock()
    pending.forEach(cb)
  }

  func detach() {
    lock.lock()
    listener = nil
    lock.unlock()
  }

  func reply(id: String, json: String) {
    lock.lock()
    let handler = handlers.removeValue(forKey: id)
    lock.unlock()
    handler?(["json": json])
  }

  // MARK: WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    guard let id = message["id"] as? String, let type = message["type"] as? String else {
      replyHandler(["json": #"{"ok":false,"error":"bad message"}"#])
      return
    }
    let action = WatchAction(id: id, type: type, payload: (message["payload"] as? String) ?? "{}")
    lock.lock()
    handlers[id] = replyHandler
    let cb = listener
    if cb == nil { queue.append(action) }
    lock.unlock()
    cb?(action)

    // No answer in 20 seconds: tell the watch and forget the handler.
    DispatchQueue.global().asyncAfter(deadline: .now() + 20) { [weak self] in
      self?.reply(id: id, json: #"{"ok":false,"error":"timeout"}"#)
    }
  }
}
