import SwiftUI

// Pass.dc.html
struct PassView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    let p = store.snapshot.pass
    ScreenFrame(title: L10n.t("yourPass"), gap: 6) {
      QRCodeView(rows: p?.qr ?? [])
        .frame(width: sc(108), height: sc(108))
        .padding(sc(9)).background(RoundedRectangle(cornerRadius: sc(15), style: .continuous).fill(Color.glIvory))
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Entry code")
      VStack(spacing: sc(1)) {
        Text(p?.name ?? "").font(Theme.display(22)).foregroundStyle(Color.glIvory).lineLimit(1).minimumScaleFactor(0.6)
        Text(p?.line ?? "").font(Theme.body(12)).foregroundStyle(Color.glIvorySoft).lineLimit(1).minimumScaleFactor(0.7)
      }
      .frame(maxWidth: .infinity)
    }
  }
}

/// Draws the QR matrix the phone sent: rows of "0" and "1", dark modules in ink.
struct QRCodeView: View {
  let rows: [String]
  var body: some View {
    Canvas { ctx, size in
      let n = rows.count
      guard n > 0 else { return }
      let cell = size.width / CGFloat(n)
      for (y, row) in rows.enumerated() {
        for (x, ch) in row.enumerated() where ch == "1" {
          ctx.fill(Path(CGRect(x: CGFloat(x) * cell, y: CGFloat(y) * cell, width: cell + 0.3, height: cell + 0.3)), with: .color(.glInk))
        }
      }
    }
    .aspectRatio(1, contentMode: .fit)
  }
}
