#!/bin/bash
# Rebuilds the watch app, installs it on a watch simulator and screenshots every demo screen into docs/watch/shots/.
# Usage: docs/watch/tools/shoot.sh [watch-udid]   (run from guestly-mobile/)
set -e
W=${1:-F1EF2706-3733-4309-88B1-BCCB585DB950}
ID=com.zcventures.guestly.watchkitapp
S=docs/watch/shots; mkdir -p $S
(cd ios && xcodebuild -workspace Guestly.xcworkspace -scheme GuestlyWatchApp -destination 'generic/platform=watchOS Simulator' -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | sort -u)
xcrun simctl boot $W 2>/dev/null || true
xcrun simctl install $W ios/build/dd/Build/Products/Debug-watchsimulator/GuestlyWatchApp.app
shot(){ xcrun simctl terminate $W $ID >/dev/null 2>&1 || true; xcrun simctl launch $W $ID -glDemo $1 -glDemoPage $2 ${3:+-glDemoLang $3} >/dev/null; sleep 2.5; xcrun simctl io $W screenshot $S/$4.png >/dev/null 2>&1; }
shot couple countdown "" couple-countdown; shot couple replies "" couple-replies; shot couple today "" couple-today
shot couple budget "" couple-budget; shot couple team "" couple-team; shot couple needsyou "" couple-needsyou; shot couple ask "" couple-ask
shot couple-dayof runninglate "" dayof-runninglate; shot couple-dayof nownext "" dayof-nownext; shot couple-dayof door "" dayof-door; shot couple-dayof vendors "" dayof-vendors
shot planner-dayof weddings "" planner-weddings; shot guest pass "" guest-pass; shot guest myday "" guest-myday; shot guest countdown "" guest-countdown
shot couple countdown es couple-countdown-es; shot couple today es couple-today-es; shot couple-dayof needsyou es couple-needsyou-es; shot couple-dayof door es dayof-door-es
echo shots: $(ls $S | wc -l)
