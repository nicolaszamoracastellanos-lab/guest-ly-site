import Foundation

// The snapshot the iPhone sends (version 1). All text is final display text in
// `lang`; the watch does no formatting and no business logic.

struct Snapshot: Codable, Equatable {
  var v: Int = 1
  var at: Double = 0
  var lang: String = "en"
  var enabled: Bool = true
  var role: String = "none"            // couple | planner | guest | none
  var wedding: Wedding?
  var replies: Replies?
  var tasks: Tasks?
  var budget: Budget?
  var team: [TeamMember]?
  var dayOf: DayOf?
  var door: Door?
  var vendorsToday: VendorsToday?
  var weddings: [WeddingRow]?
  var needsYou: [NeedsYouItem]?
  var pass: Pass?
  var myDay: [MyDayItem]?

  struct Wedding: Codable, Equatable {
    var names: String
    var dateText: String
    var days: Int
    var passed: Bool
    var isDayOf: Bool
  }
  struct Replies: Codable, Equatable { var going: Int; var pending: Int; var declined: Int; var total: Int }
  struct Tasks: Codable, Equatable {
    var done: Int
    var total: Int
    var items: [Item]
    struct Item: Codable, Equatable, Identifiable {
      var id: String
      var title: String
      var note: String
      var urgent: Bool
      var done: Bool
    }
  }
  struct Budget: Codable, Equatable {
    var paidText: String
    var totalText: String
    var fraction: Double
    var next: Next?
    struct Next: Codable, Equatable { var name: String; var amountText: String; var dueText: String }
  }
  struct TeamMember: Codable, Equatable, Identifiable {
    var name: String
    var note: String
    var tel: String
    var id: String { name + tel }
  }
  struct DayOf: Codable, Equatable {
    var now: Now?
    var next: [Next]
    var overrun: Overrun?
    struct Now: Codable, Equatable {
      var title: String
      var line: String
      var leftText: String
      var fraction: Double?
    }
    struct Next: Codable, Equatable, Identifiable {
      var time: String
      var title: String
      var id: String { time + title }
    }
    struct Overrun: Codable, Equatable {
      var blockId: String
      var question: String
      var body: String
      var pushLabel: String
      var keepLabel: String
    }
  }
  struct Door: Codable, Equatable {
    var inCount: Int
    var total: Int
    var lastText: String?
  }
  struct VendorsToday: Codable, Equatable {
    var summary: String
    var items: [Item]
    struct Item: Codable, Equatable, Identifiable {
      var blockId: String
      var name: String
      var note: String
      var state: String                // onsite | due | late
      var tel: String?
      var id: String { blockId }
    }
  }
  struct WeddingRow: Codable, Equatable, Identifiable {
    var label: String
    var names: String
    var line: String
    var today: Bool
    var id: String { names + label }
  }
  struct NeedsYouItem: Codable, Equatable, Identifiable {
    var id: String
    var from: String
    var question: String
    var canReply: Bool
  }
  struct Pass: Codable, Equatable {
    var name: String
    var line: String
    var qr: [String]
  }
  struct MyDayItem: Codable, Equatable, Identifiable {
    var time: String
    var title: String
    var note: String
    var soon: Bool
    var id: String { time + title }
  }
}

/// What the phone answers to an action.
struct ActionReply: Decodable {
  var ok: Bool
  var error: String?
  var data: [String: AnyCodable]?
}

enum ActionResult {
  case success(ActionReply)
  case failure(String)
  case phoneNeeded
}

/// Minimal JSON value, enough to read `data` fields from a reply.
struct AnyCodable: Decodable, Equatable {
  let value: Any
  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if c.decodeNil() { value = NSNull() }
    else if let b = try? c.decode(Bool.self) { value = b }
    else if let i = try? c.decode(Int.self) { value = i }
    else if let d = try? c.decode(Double.self) { value = d }
    else if let s = try? c.decode(String.self) { value = s }
    else if let a = try? c.decode([AnyCodable].self) { value = a.map { $0.value } }
    else if let o = try? c.decode([String: AnyCodable].self) { value = o.mapValues { $0.value } }
    else { value = NSNull() }
  }
  static func == (l: AnyCodable, r: AnyCodable) -> Bool { String(describing: l.value) == String(describing: r.value) }
}
