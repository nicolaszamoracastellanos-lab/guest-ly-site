import SwiftUI
import WidgetKit

@main
struct GuestlyWatchWidgetBundle: WidgetBundle {
  var body: some Widget {
    GLCountdown()
    GLArrivals()
    GLNowNext()
    GLReplies()
  }
}

// MARK: Countdown (accessoryCircular, accessoryCorner, accessoryInline)

struct CountdownView: View {
  @Environment(\.widgetFamily) var family
  let e: SnapEntry

  var body: some View {
    let es = e.snap?.es ?? false
    let days = e.days
    switch family {
    case .accessoryCorner:
      Text(days.map(String.init) ?? "·")
        .font(WF.display(24)).widgetAccentable()
        .widgetLabel { Text(WL.t("daysToGo", es)) }
    case .accessoryInline:
      if let w = e.snap?.wedding, let d = days {
        Text("\(d) \(WL.t(d == 1 ? "day" : "days", es)) · \(w.names)")
      } else {
        Text("Guest-ly")
      }
    default:
      ZStack {
        AccessoryWidgetBackground()
        Circle().stroke(Color.white.opacity(0.18), lineWidth: 4).padding(3)
        Circle().trim(from: 0, to: CGFloat(days.map { 1 - min(1, Double($0) / 365) } ?? 0))
          .stroke(Color.glGold, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90)).padding(3).widgetAccentable()
        VStack(spacing: -2) {
          Text(days.map(String.init) ?? "·").font(WF.display(days.map { $0 > 99 ? 20 : 24 } ?? 24))
          Text(WL.t("days", es)).font(WF.bodySemibold(8)).textCase(.uppercase).tracking(0.8).foregroundStyle(Color.glGold).widgetAccentable()
        }
      }
    }
  }
}

struct GLCountdown: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GLCountdown", provider: SnapProvider()) { e in
      CountdownView(e: e).containerBackground(.black, for: .widget).widgetURL(URL(string: "guestly-watch://page/countdown"))
    }
    .configurationDisplayName("Countdown")
    .description("Days to the wedding.")
    .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
  }
}

// MARK: Arrivals (accessoryCircular)

struct ArrivalsView: View {
  let e: SnapEntry
  var body: some View {
    let d = e.snap?.door
    let frac = (d?.total ?? 0) > 0 ? Double(d?.inCount ?? 0) / Double(d?.total ?? 1) : 0
    ZStack {
      AccessoryWidgetBackground()
      Circle().stroke(Color.white.opacity(0.18), lineWidth: 4).padding(3)
      Circle().trim(from: 0, to: CGFloat(min(1, frac))).stroke(Color.glIvory, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90)).padding(3).widgetAccentable()
      VStack(spacing: -2) {
        Text(d.map { String($0.inCount) } ?? "–").font(WF.display(24))
        Text(WL.t("here", e.snap?.es ?? false)).font(WF.bodySemibold(8)).textCase(.uppercase).tracking(0.8).foregroundStyle(Color.glIvorySoft).widgetAccentable()
      }
    }
  }
}

struct GLArrivals: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GLArrivals", provider: SnapProvider(relevantWhenDayOf: true)) { e in
      ArrivalsView(e: e).containerBackground(.black, for: .widget).widgetURL(URL(string: "guestly-watch://page/door"))
    }
    .configurationDisplayName("Arrivals")
    .description("Guests at the door.")
    .supportedFamilies([.accessoryCircular])
  }
}

// MARK: Now and next (accessoryRectangular)

struct NowNextWidgetView: View {
  let e: SnapEntry
  var body: some View {
    let es = e.snap?.es ?? false
    HStack(spacing: 6) {
      RoundedRectangle(cornerRadius: 1.5).fill(Color.glGold).frame(width: 3).widgetAccentable()
      VStack(alignment: .leading, spacing: 0) {
        if let now = e.snap?.dayOf?.now {
          Text("\(WL.t("now", es)) · \(now.leftText)").font(WF.bodySemibold(10)).textCase(.uppercase).tracking(0.6).foregroundStyle(Color.glGold).lineLimit(1).widgetAccentable()
          Text(now.title).font(WF.display(19)).lineLimit(1).minimumScaleFactor(0.7)
          if let n = e.snap?.dayOf?.next?.first { Text("\(WL.t("next", es)) \(n.time) \(n.title)").font(WF.body(11)).foregroundStyle(Color.glIvorySoft).lineLimit(1) }
        } else if let w = e.snap?.wedding, let d = e.days {
          Text(w.names).font(WF.display(19)).lineLimit(1).minimumScaleFactor(0.7)
          Text("\(d) \(WL.t("daysToGo", es))").font(WF.body(11)).foregroundStyle(Color.glIvorySoft).lineLimit(1)
        } else {
          Text("Guest-ly").font(WF.display(19))
          Text(WL.t("openPhone", es)).font(WF.body(11)).foregroundStyle(Color.glIvorySoft)
        }
      }
      Spacer(minLength: 0)
    }
  }
}

struct GLNowNext: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GLNowNext", provider: SnapProvider(relevantWhenDayOf: true)) { e in
      NowNextWidgetView(e: e).containerBackground(.black, for: .widget).widgetURL(URL(string: "guestly-watch://page/nownext"))
    }
    .configurationDisplayName("Now and next")
    .description("What is happening now at the wedding.")
    .supportedFamilies([.accessoryRectangular])
  }
}

// MARK: Replies (accessoryRectangular, Smart Stack)

struct RepliesWidgetView: View {
  let e: SnapEntry
  var body: some View {
    let es = e.snap?.es ?? false
    HStack(spacing: 8) {
      ZStack {
        Circle().fill(Color.glNavy)
        Rectangle().fill(Color.glGold).frame(width: 9, height: 9).rotationEffect(.degrees(45))
      }
      .frame(width: 28, height: 28).widgetAccentable()
      VStack(alignment: .leading, spacing: 0) {
        if e.snap?.role == "planner", let w = e.snap?.weddings?.first {
          Text(w.names).font(WF.display(16)).lineLimit(1).minimumScaleFactor(0.7)
          Text(w.line.isEmpty ? w.label : w.line).font(WF.body(11)).foregroundStyle(Color.glIvorySoft).lineLimit(1)
        } else if let r = e.snap?.replies {
          Text("\(r.going) " + String(format: WL.t("comingOf", es), r.total)).font(WF.bodySemibold(13)).lineLimit(1).minimumScaleFactor(0.7)
          Text(String(format: WL.t("pending", es), r.pending)).font(WF.body(11)).foregroundStyle(Color.glIvorySoft).lineLimit(1)
        } else {
          Text("Guest-ly").font(WF.display(16))
          Text(WL.t("openPhone", es)).font(WF.body(11)).foregroundStyle(Color.glIvorySoft)
        }
      }
      Spacer(minLength: 0)
    }
  }
}

struct GLReplies: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GLReplies", provider: SnapProvider()) { e in
      RepliesWidgetView(e: e).containerBackground(Color.glNavy, for: .widget).widgetURL(URL(string: "guestly-watch://page/replies"))
    }
    .configurationDisplayName("Replies")
    .description("Who is coming.")
    .supportedFamilies([.accessoryRectangular])
  }
}
