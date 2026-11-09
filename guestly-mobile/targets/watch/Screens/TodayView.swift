import SwiftUI

// Today.dc.html
struct TodayView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let t = store.snapshot.tasks
    ScreenFrame(title: L10n.t("today"), trailing: t.map { L10n.f("doneOf", $0.done, $0.total) }, gap: 7) {
      VStack(spacing: sc(5)) {
        ForEach(t?.items ?? []) { item in
          Button {
            Task { await toggle(item) }
          } label: {
            HStack(spacing: sc(8)) {
              CheckCircle(done: item.done)
              VStack(alignment: .leading, spacing: sc(1)) {
                Text(item.title).font(Theme.body(14)).foregroundStyle(item.done ? Color.glMuted : Color.glIvory)
                  .strikethrough(item.done).lineLimit(2).minimumScaleFactor(0.8)
                Text(item.note).font(Theme.body(11)).foregroundStyle(item.urgent && !item.done ? Color.glGoldLight : Color.glMuted).lineLimit(1)
              }
              Spacer(minLength: 0)
            }
            .padding(.horizontal, sc(10)).frame(height: sc(58)).card()
          }
          .buttonStyle(.plain)
          .accessibilityLabel(item.title)
          .accessibilityValue(item.done ? "done" : "open")
        }
      }
    }
  }

  /// Optimistic: flip at once, revert when the phone says no.
  private func toggle(_ item: Snapshot.Tasks.Item) async {
    guard var tasks = store.snapshot.tasks, let i = tasks.items.firstIndex(where: { $0.id == item.id }) else { return }
    let was = tasks
    tasks.items[i].done.toggle()
    tasks.done += tasks.items[i].done ? 1 : -1
    store.snapshot.tasks = tasks
    let r = await store.run("task.toggle", ["id": item.id, "done": tasks.items[i].done])
    if r == nil { store.snapshot.tasks = was }
  }
}
