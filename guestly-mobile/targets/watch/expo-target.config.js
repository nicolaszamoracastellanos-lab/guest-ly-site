/** Guest-ly Apple Watch app (SwiftUI, installs with the iPhone app). */
const GROUP = "group.com.zcventures.guestly";

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch",
  name: "GuestlyWatchApp",
  displayName: "Guest-ly",
  bundleIdentifier: ".watchkitapp",
  deploymentTarget: "10.0",
  icon: "../../assets/brand/icon.png",
  frameworks: ["SwiftUI", "WatchConnectivity", "WidgetKit"],
  entitlements: { "com.apple.security.application-groups": [GROUP] },
};
