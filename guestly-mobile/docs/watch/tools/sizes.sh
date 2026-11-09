#!/bin/bash
ID=com.zcventures.guestly.watchkitapp; S=docs/watch/shots; APP=ios/build/dd/Build/Products/Debug-watchsimulator/GuestlyWatchApp.app
for pair in "E2C3B260-4F15-4FC8-8C53-BF09C3A68BB3:42mm" "C230697B-9F8A-45BF-84F6-BE2526770730:49mm"; do
  W=${pair%%:*}; N=${pair##*:}
  xcrun simctl shutdown $W 2>/dev/null; xcrun simctl erase $W; xcrun simctl boot $W; sleep 25; xcrun simctl install $W $APP
  for sc in "couple:countdown" "couple:today" "couple-dayof:door"; do
    kind=${sc%%:*}; page=${sc##*:}
    xcrun simctl terminate $W $ID >/dev/null 2>&1
    xcrun simctl launch $W $ID -glDemo $kind -glDemoPage $page >/dev/null; sleep 3
    xcrun simctl io $W screenshot $S/size-$N-$page.png >/dev/null 2>&1
  done
  xcrun simctl shutdown $W 2>/dev/null
done
ls $S | grep size
