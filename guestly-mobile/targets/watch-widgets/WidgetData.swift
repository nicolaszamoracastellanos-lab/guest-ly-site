import SwiftUI
import WidgetKit

// The complications read the snapshot the watch app saved in the shared app
// group (key gl.watch.snapshot). They never touch the network. Only the fields
// they draw are decoded, all optional, so a newer snapshot never breaks them.

let glGroup = "group.com.zcventures.guestly"
let glSnapshotKey = "gl.watch.snapshot"

struct WSnap: Decodable {
  var at: Double?
  var lang: String?
  var enabled: Bool?
  var role: String?
  var wedding: Wedding?
  var replies: Replies?
  var door: Door?
  var dayOf: DayOf?
  var weddings: [WeddingRow]?

  struct Wedding: Decodable { var names: String; var days: Int; var passed: Bool; var isDayOf: Bool }
  struct Replies: Decodable { var going: Int; var pending: Int; var declined: Int; var total: Int }
  struct Door: Decodable { var inCount: Int; var total: Int }
  struct DayOf: Decodable {
    var now: Now?
    var next: [Next]?
    struct Now: Decodable { var title: String; var leftText: String }
    struct Next: Decodable { var time: String; var title: String }
  }
  struct WeddingRow: Decodable { var label: String; var names: String; var line: String; var today: Bool }

  static func load() -> WSnap? {
    guard let raw = UserDefaults(suiteName: glGroup)?.string(forKey: glSnapshotKey), let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WSnap.self, from: data)
  }
  var usable: Bool { (enabled ?? true) && (role ?? "none") != "none" }
  var es: Bool { lang == "es" }
}

/// The few fixed words the complications need, in the snapshot's language.
enum WL {
  static func t(_ key: String, _ es: Bool) -> String { (es ? Self.esT[key] : nil) ?? enT[key] ?? key }
  static let enT = ["days": "days", "day": "day", "daysToGo": "days to go", "here": "here", "now": "Now", "next": "Next", "comingOf": "of %d coming", "pending": "%d still pending", "justMarried": "Just married", "openPhone": "Open Guest-ly"]
  static let esT = ["days": "días", "day": "día", "daysToGo": "días para la boda", "here": "llegaron", "now": "Ahora", "next": "Sigue", "comingOf": "de %d vienen", "pending": "%d pendientes", "justMarried": "Recién casados", "openPhone": "Abre Guest-ly"]
}

extension Color {
  init(hex: UInt32) {
    self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255, opacity: 1)
  }
  static let glIvory = Color(hex: 0xf7f3ec)
  static let glIvorySoft = Color(hex: 0xd9d3c6)
  static let glMuted = Color(hex: 0xa8a08f)
  static let glGold = Color(hex: 0xc9a96e)
  static let glGoldLight = Color(hex: 0xe2c892)
  static let glNavy = Color(hex: 0x16213a)
}

enum WF {
  static func display(_ s: CGFloat) -> Font { .custom("CormorantGaramond-SemiBold", fixedSize: s) }
  static func body(_ s: CGFloat) -> Font { .custom("Jost-Regular", fixedSize: s) }
  static func bodySemibold(_ s: CGFloat) -> Font { .custom("Jost-SemiBold", fixedSize: s) }
}

struct SnapEntry: TimelineEntry {
  let date: Date
  let snap: WSnap?
  /// Days to the wedding as of this entry (counts down across midnights).
  let days: Int?
  var relevance: TimelineEntryRelevance? = nil
}

/// One entry now, then one at each of the next 7 local midnights with the day count going down.
struct SnapProvider: TimelineProvider {
  var relevantWhenDayOf = false

  func placeholder(in context: Context) -> SnapEntry { SnapEntry(date: .now, snap: nil, days: 132) }
  func getSnapshot(in context: Context, completion: @escaping (SnapEntry) -> Void) { completion(make(.now, 0)) }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SnapEntry>) -> Void) {
    let cal = Calendar.current
    let start = cal.startOfDay(for: .now)
    var entries = [make(.now, 0)]
    for k in 1...7 { if let d = cal.date(byAdding: .day, value: k, to: start) { entries.append(make(d, k)) } }
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  private func make(_ date: Date, _ k: Int) -> SnapEntry {
    let snap = WSnap.load()
    let days = snap?.wedding.map { max(0, $0.days - k) }
    let score: Float = relevantWhenDayOf && (snap?.wedding?.isDayOf ?? false) ? 10 : 0
    return SnapEntry(date: date, snap: snap, days: days, relevance: score > 0 ? TimelineEntryRelevance(score: score) : nil)
  }
}
