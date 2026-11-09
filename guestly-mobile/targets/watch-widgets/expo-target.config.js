/** Guest-ly watch face complications and Smart Stack cards (WidgetKit). */
const GROUP = "group.com.zcventures.guestly";

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch-widget",
  name: "GuestlyWatchWidgets",
  displayName: "Guest-ly",
  bundleIdentifier: ".watchkitapp.widgets",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  colors: { $accent: "#c9a96e", $widgetBackground: "#000000" },
  entitlements: { "com.apple.security.application-groups": [GROUP] },
};
