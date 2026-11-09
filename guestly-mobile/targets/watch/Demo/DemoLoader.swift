#if DEBUG
import Foundation

/// Debug-only demo mode: launch with `-glDemo couple|couple-dayof|planner-dayof|guest`
/// and optionally `-glDemoLang es`. Loads the invented sample wedding and answers
/// every action locally after 0.4 s. Never compiled into Release.
enum DemoLoader {
  static func requestedDemo() -> String? {
    guard let kind = UserDefaults.standard.string(forKey: "glDemo"), !kind.isEmpty else { return nil }
    return UserDefaults.standard.string(forKey: "glDemoLang") == "es" ? kind + "-es" : kind
  }

  static func load(_ kind: String) -> Snapshot {
    let raw = DemoData.json[kind] ?? DemoData.json["couple"]!
    let s = WatchStore.decode(raw) ?? Snapshot()
    L10n.lang = s.lang
    return s
  }

  @MainActor
  static func act(_ type: String, _ payload: [String: Any], store: WatchStore) async -> ActionResult {
    try? await Task.sleep(nanoseconds: 400_000_000)
    func ok(_ data: [String: Any] = [:]) -> ActionResult {
      let json = (try? JSONSerialization.data(withJSONObject: ["ok": true, "data": data])) ?? Data()
      return .success((try? JSONDecoder().decode(ActionReply.self, from: json)) ?? ActionReply(ok: true))
    }
    let es = store.snapshot.lang == "es"
    switch type {
    case "checkin.search":
      return ok(["results": [
        ["guestId": "g1", "name": "Mateo Rojas", "line": es ? "Grupo de 2 · Mesa 4" : "Party of 2 · Table 4", "already": true],
        ["guestId": "g2", "name": "Lucía Fernández", "line": es ? "Grupo de 2 · Mesa 5" : "Party of 2 · Table 5", "already": false],
      ]])
    case "coordinator.ask":
      let text = es ? "Faltan 31 invitados por responder. 12 son del lado de Andrés." : "31 guests are still pending. 12 are on Andrés's side."
      return ok(["text": text, "card": ["actionId": "demo", "confirmLabel": es ? "Recordar a los 31" : "Remind all 31"]])
    case "coordinator.confirm":
      return ok(["text": es ? "Listo. Recordatorio enviado a 31 invitados." : "Done. Reminder sent to 31 guests."])
    default:
      return ok()
    }
  }
}
#endif
