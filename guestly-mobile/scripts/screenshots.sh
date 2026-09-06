#!/usr/bin/env bash
# Store screenshots from the iOS Simulator and the Android emulator, demo
# tenant only (invite code CAMAND, review@guest-ly.com, planner-review@guest-ly.com).
#
# Requirements on the Mac running this:
#   Xcode.app with the iOS 26 runtime (xcrun simctl), a development build
#   installed on the simulators (`npx eas build -p ios --profile development`
#   then `npx expo run:ios` or `eas build:run`), Android Studio with a Pixel 8
#   AVD, and the development APK installed.
#
# Output: store/screenshots/ios-6.7/{en,es}, store/screenshots/ios-6.1/{en,es},
#         store/screenshots/android/{en,es}
#
# The walk is manual by design: the script opens the app on each screen via
# deep links and captures; a person taps through sign-in once per device.

set -euo pipefail
cd "$(dirname "$0")/.."
OUT=store/screenshots
mkdir -p "$OUT"

SCREENS_GUEST=("guestly:///guest" "guestly:///guest/rsvp" "guestly:///guest/schedule" "guestly:///guest/concierge" "guestly:///guest/dayof" "guestly:///guest/messages" "guestly:///guest/more")
SCREENS_COUPLE=("guestly:///couple" "guestly:///couple/guests" "guestly:///couple/rsvps" "guestly:///couple/messages" "guestly:///couple/more" "guestly:///couple/dayof" "guestly:///couple/checkin" "guestly:///settings")
SCREENS_PLANNER=("guestly:///planner" "guestly:///planner/guests" "guestly:///planner/requests" "guestly:///planner/budget" "guestly:///planner/more")

ios_run() {
  local device="$1" folder="$2" lang="$3"
  local udid
  udid=$(xcrun simctl list devices available -j | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(x['udid'] for v in d['devices'].values() for x in v if x['name']=='$device'))")
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl spawn "$udid" defaults write -g AppleLanguages -array "$lang" || true
  mkdir -p "$OUT/$folder/$lang"
  for url in "${SCREENS_GUEST[@]}" "${SCREENS_COUPLE[@]}" "${SCREENS_PLANNER[@]}"; do
    xcrun simctl openurl "$udid" "$url"
    sleep 2.5
    name=$(echo "$url" | sed 's#guestly:///##; s#/#-#g')
    xcrun simctl io "$udid" screenshot "$OUT/$folder/$lang/$name.png"
  done
}

android_run() {
  local lang="$1"
  mkdir -p "$OUT/android/$lang"
  adb shell "setprop persist.sys.locale $lang; setprop ctl.restart zygote" || true
  sleep 8
  for url in "${SCREENS_GUEST[@]}" "${SCREENS_COUPLE[@]}" "${SCREENS_PLANNER[@]}"; do
    adb shell am start -a android.intent.action.VIEW -d "$url" com.zcventures.guestly
    sleep 2.5
    name=$(echo "$url" | sed 's#guestly:///##; s#/#-#g')
    adb exec-out screencap -p > "$OUT/android/$lang/$name.png"
  done
}

case "${1:-all}" in
  ios)
    ios_run "iPhone 16 Pro Max" ios-6.7 en; ios_run "iPhone 16 Pro Max" ios-6.7 es
    ios_run "iPhone 16 Pro" ios-6.1 en;     ios_run "iPhone 16 Pro" ios-6.1 es ;;
  android)
    android_run en-US; android_run es-419 ;;
  all)
    "$0" ios; "$0" android ;;
esac
echo "Screenshots in $OUT. Review each one: no Alexandra and Nicolas data, no em dashes, no text under 13px, one ivory card per screen at most."
