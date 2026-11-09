#if DEBUG
import Foundation

enum DemoLoader {
  static func requestedDemo() -> String? { nil }
  static func load(_ kind: String) -> Snapshot { Snapshot() }
  @MainActor static func act(_ type: String, _ payload: [String: Any], store: WatchStore) async -> ActionResult { .phoneNeeded }
}
#endif
