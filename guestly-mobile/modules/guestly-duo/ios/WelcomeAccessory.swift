// "Welcome, Whitney. Table 5" on the iPhone Duo's OUTER display while the door
// check-in scans on the inner one.
//
// Apple (Tech Talk 111464): CameraCaptureAccessory pairs extra UI on the outer
// display with the app's main UI on the inner display. It is available only
// while the app is full screen on the inner display AND has an active camera
// session; the system decides when it shows and may withdraw it at any time
// (device closed, app left the foreground, capture session ended). So this is
// an extra: the check-in works the same without it, and `onAvailabilityChange`
// tells JS whether it can currently appear.
//
// An invisible hosting view lives inside the check-in screen and carries the
// `.sceneAccessory` modifier; React Native feeds it the guest, table and state.

import ExpoModulesCore
import SwiftUI
import UIKit

final class WelcomeModel: ObservableObject {
  @Published var enabled = true
  @Published var state = "idle"      // idle | found | checked | notFound
  @Published var couple = ""
  @Published var name = ""
  @Published var table = ""
  @Published var seats = 1
  @Published var lang = "en"
}

@available(iOS 27.1, *)
private struct WelcomeFace: View {
  @ObservedObject var model: WelcomeModel

  private var es: Bool { model.lang == "es" }
  private let gold = Color(red: 0.89, green: 0.78, blue: 0.57)
  private let ivory = Color(red: 0.97, green: 0.95, blue: 0.92)

  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: "diamond.fill").font(.system(size: 28)).foregroundStyle(gold)
      switch model.state {
      case "found", "checked":
        Text(es ? "Bienvenid@," : "Welcome,").font(.system(size: 24, design: .serif)).foregroundStyle(ivory)
        Text(model.name).font(.system(size: 42, weight: .semibold, design: .serif)).foregroundStyle(gold)
          .minimumScaleFactor(0.5).lineLimit(2).multilineTextAlignment(.center)
        if !model.table.isEmpty {
          Text((es ? "Mesa " : "Table ") + model.table).font(.system(size: 28, design: .serif)).foregroundStyle(ivory)
        }
        Text(es ? "¡Que la disfrutes!" : "Enjoy the night!").font(.system(size: 17)).foregroundStyle(ivory.opacity(0.75))
      case "notFound":
        Text(es ? "No encontramos tu nombre" : "We could not find your name").font(.system(size: 24, design: .serif)).foregroundStyle(ivory)
        Text(es ? "Habla con quien te recibe" : "Please ask the person at the door").font(.system(size: 16)).foregroundStyle(ivory.opacity(0.75))
      default:
        Text(model.couple).font(.system(size: 34, weight: .semibold, design: .serif)).foregroundStyle(gold)
          .minimumScaleFactor(0.5).lineLimit(2).multilineTextAlignment(.center)
        Text(es ? "Muestra tu pase a la cámara" : "Show your pass to the camera").font(.system(size: 16)).foregroundStyle(ivory.opacity(0.75))
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(LinearGradient(colors: [Color(red: 0.09, green: 0.13, blue: 0.23), Color(red: 0.03, green: 0.04, blue: 0.06)], startPoint: .topLeading, endPoint: .bottomTrailing))
  }
}

@available(iOS 27.1, *)
private struct WelcomeHost: View {
  @ObservedObject var model: WelcomeModel
  var onAvailability: (Bool) -> Void

  var body: some View {
    Color.clear
      .sceneAccessory {
        CameraCaptureAccessory(isEnabled: $model.enabled) {
          WelcomeFace(model: model)
        }
        .onAvailabilityChange { onAvailability($0) }
      }
  }
}

public final class WelcomeAccessoryView: ExpoView {
  let model = WelcomeModel()
  let onAvailabilityChange = EventDispatcher()
  private var host: UIViewController?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    backgroundColor = .clear
    if #available(iOS 27.1, *) {
      let controller = UIHostingController(rootView: WelcomeHost(model: model, onAvailability: { [weak self] available in
        self?.onAvailabilityChange(["available": available])
      }))
      controller.view.backgroundColor = .clear
      controller.view.frame = bounds
      controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      addSubview(controller.view)
      host = controller
    }
  }

  // The hosting controller must be a child of the screen's view controller for
  // the scene (and its accessories) to see it.
  public override func didMoveToWindow() {
    super.didMoveToWindow()
    guard let host else { return }
    if window != nil, host.parent == nil, let parent = Self.parentController(of: self) {
      parent.addChild(host)
      host.didMove(toParent: parent)
    } else if window == nil, host.parent != nil {
      host.willMove(toParent: nil)
      host.removeFromParent()
    }
  }

  private static func parentController(of view: UIView) -> UIViewController? {
    var responder: UIResponder? = view
    while let next = responder?.next {
      if let controller = next as? UIViewController { return controller }
      responder = next
    }
    return nil
  }
}
