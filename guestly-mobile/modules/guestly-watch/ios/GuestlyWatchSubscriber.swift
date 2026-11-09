import ExpoModulesCore
import UIKit

public class GuestlyWatchSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    WatchSession.shared.activate()
    return true
  }
}
