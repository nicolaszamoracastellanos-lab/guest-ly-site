#!/bin/bash
# Part 9 simulator helper. Every subcommand takes a device letter (S, M, L,
# T, P from env.sh) or a raw UDID.
#
#   sim.sh create                    create the small SE simulator (once)
#   sim.sh boot <dev>                boot, open Simulator.app, dark, 9:41 status bar
#   sim.sh shutdown <dev>
#   sim.sh install <dev> <App.app>   install the build, hide the dev menu and its floating button
#   sim.sh devprefs <dev>            only the dev menu switches (run again if the gear button comes back)
#   sim.sh grant <dev>               camera + photos granted (populated passes)
#   sim.sh revoke <dev>              reset every permission (denied-state passes)
#   sim.sh launch <dev>              terminate, then load the JS bundle (dev) or launch (release)
#   sim.sh open <dev> <route>        deep link, for example /couple/budget
#   sim.sh shot <dev> <file.png>     screenshot
#   sim.sh statusbar <dev>           9:41, full battery, full bars
#   sim.sh lang <dev> en|es          SYSTEM language of the simulator (permission prompts); needs a reboot, done here
#   sim.sh dyn <dev> <size>          Dynamic Type, for example large or accessibility-extra-extra-extra-large
#   sim.sh appearance <dev> dark|light
#   sim.sh erase <dev>
#   sim.sh teardown                  shut down and erase S M L T P, delete the created SE, stop Metro, proxy, web server
#
# macOS has no timeout binary; nothing here blocks for long.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/env.sh"

cmd="${1:-help}"
dev="$(gl_udid "${2:-}")"

need_dev() {
  if [ -z "$dev" ]; then echo "device letter or UDID required" >&2; exit 2; fi
}

statusbar() {
  xcrun simctl status_bar "$dev" override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 --dataNetwork wifi --wifiMode active --cellularMode active 2>/dev/null || true
}

# The dev client keeps its switches in the APP CONTAINER preferences, not in
# the simulator-wide domain, so the plist path is addressed directly. This
# hides the floating gear button and the first-launch developer menu, both of
# which would otherwise sit on top of every screenshot. No effect on release.
devprefs() {
  xcrun simctl terminate "$dev" "$GL_BUNDLE_ID" 2>/dev/null || true
  local data
  data="$(xcrun simctl get_app_container "$dev" "$GL_BUNDLE_ID" data 2>/dev/null)" || return 0
  local plist="$data/Library/Preferences/$GL_BUNDLE_ID"
  mkdir -p "$data/Library/Preferences"
  xcrun simctl spawn "$dev" defaults write "$plist" EXDevMenuIsOnboardingFinished -bool YES
  xcrun simctl spawn "$dev" defaults write "$plist" EXDevMenuShowFloatingActionButton -bool NO
  xcrun simctl spawn "$dev" defaults write "$plist" EXDevMenuShowsAtLaunch -bool NO
  xcrun simctl spawn "$dev" defaults write "$plist" EXDevMenuMotionGestureEnabled -bool NO
  xcrun simctl spawn "$dev" defaults write "$plist" EXDevMenuTouchGestureEnabled -bool NO
}

case "$cmd" in
  create)
    xcrun simctl create "GL-S iPhone SE3" "iPhone SE (3rd generation)" com.apple.CoreSimulator.SimRuntime.iOS-26-5
    echo "put the UDID above into scripts/part9/env.sh as GL_UDID_S"
    ;;
  boot)
    need_dev
    xcrun simctl boot "$dev" 2>/dev/null || true
    xcrun simctl bootstatus "$dev" -b >/dev/null
    open -a Simulator
    xcrun simctl ui "$dev" appearance dark
    statusbar
    # The keyboard shows a one-time "slide to type" tutorial over the first text field. Mark it seen.
    xcrun simctl spawn "$dev" defaults write com.apple.keyboard.preferences DidShowContinuousPathIntroduction -bool true
    xcrun simctl spawn "$dev" defaults write com.apple.keyboard.preferences DidShowGestureKeyboardIntroduction -bool true
    echo "booted $dev"
    ;;
  shutdown)
    need_dev
    xcrun simctl shutdown "$dev" 2>/dev/null || true
    ;;
  install)
    need_dev
    app="${3:?path to the .app}"
    xcrun simctl install "$dev" "$app"
    devprefs
    echo "installed on $dev"
    ;;
  devprefs)
    need_dev
    devprefs
    ;;
  grant)
    need_dev
    xcrun simctl privacy "$dev" grant camera "$GL_BUNDLE_ID"
    xcrun simctl privacy "$dev" grant photos "$GL_BUNDLE_ID"
    ;;
  revoke)
    need_dev
    xcrun simctl privacy "$dev" reset all "$GL_BUNDLE_ID"
    ;;
  launch)
    need_dev
    xcrun simctl terminate "$dev" "$GL_BUNDLE_ID" 2>/dev/null || true
    if [ "$GL_BINARY" = "release" ]; then
      xcrun simctl launch "$dev" "$GL_BUNDLE_ID" >/dev/null
    else
      xcrun simctl openurl "$dev" "$GL_DEVCLIENT_URL"
    fi
    ;;
  open)
    need_dev
    route="${3:?route, for example /couple/budget}"
    xcrun simctl openurl "$dev" "guestly://${route}"
    ;;
  shot)
    need_dev
    out="${3:?output png}"
    mkdir -p "$(dirname "$out")"
    xcrun simctl io "$dev" screenshot --type=png "$out" >/dev/null 2>&1
    echo "$out"
    ;;
  statusbar)
    need_dev
    statusbar
    ;;
  lang)
    need_dev
    l="${3:?en or es}"
    if [ "$l" = "es" ]; then loc="es_MX"; else loc="en_US"; fi
    xcrun simctl spawn "$dev" defaults write "Apple Global Domain" AppleLanguages -array "$l"
    xcrun simctl spawn "$dev" defaults write "Apple Global Domain" AppleLocale -string "$loc"
    xcrun simctl shutdown "$dev" 2>/dev/null || true
    xcrun simctl boot "$dev"
    xcrun simctl bootstatus "$dev" -b >/dev/null
    statusbar
    echo "system language of $dev is now $l (app language is separate: inject-session.mjs --lang)"
    ;;
  dyn)
    need_dev
    xcrun simctl ui "$dev" content_size "${3:?size}"
    ;;
  appearance)
    need_dev
    xcrun simctl ui "$dev" appearance "${3:?dark or light}"
    ;;
  erase)
    need_dev
    xcrun simctl shutdown "$dev" 2>/dev/null || true
    xcrun simctl erase "$dev"
    ;;
  teardown)
    for d in "$GL_UDID_S" "$GL_UDID_M" "$GL_UDID_L" "$GL_UDID_T" "$GL_UDID_P"; do
      xcrun simctl shutdown "$d" 2>/dev/null || true
      xcrun simctl erase "$d" 2>/dev/null || true
    done
    xcrun simctl delete "$GL_UDID_S" 2>/dev/null || true
    for port in "$GL_METRO_PORT" "$GL_PROXY_PORT" "$GL_WEB_PORT"; do
      pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi
    done
    rm -rf "$GL_PART9/web" "$GL_PART9"/sim-dev "$GL_PART9"/sim-release "$GL_PART9"/*.tar.gz
    echo "teardown done. Raw shots under $GL_PART9/shots are left for the step that owns them."
    ;;
  *)
    sed -n '2,22p' "$0"
    ;;
esac
