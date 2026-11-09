import SwiftUI

struct RootView: View {
  @EnvironmentObject var store: WatchStore
  var body: some View {
    PhoneNeededView()
  }
}

struct PhoneNeededView: View {
  var body: some View {
    VStack(spacing: sc(6)) {
      Text("Open Guest-ly on your iPhone")
        .font(Theme.display(25))
        .foregroundStyle(Color.glIvory)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.glBlack)
  }
}
