// Bridge to the Apple Watch app. See WatchSession.swift. JS contract:
//   isSupported(), getState(), setSnapshot(json), reply(id, json), event "onAction".

import ExpoModulesCore
import WatchConnectivity

public class GuestlyWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GuestlyWatch")

    Events("onAction")

    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    Function("getState") { () -> [String: Bool] in
      WatchSession.shared.state()
    }

    Function("setSnapshot") { (json: String) in
      WatchSession.shared.setSnapshot(json)
    }

    Function("reply") { (id: String, json: String) in
      WatchSession.shared.reply(id: id, json: json)
    }

    OnStartObserving {
      WatchSession.shared.attach { [weak self] action in
        self?.sendEvent("onAction", ["id": action.id, "type": action.type, "payload": action.payload])
      }
    }

    OnStopObserving {
      WatchSession.shared.detach()
    }
  }
}
