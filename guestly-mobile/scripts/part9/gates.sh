#!/bin/bash
# Every gate of plan section 9.3 in one command. Exit status is non-zero on
# any hit. Run before every commit:
#   bash /Users/nicolas_z/Desktop/guest-ly/guestly-mobile/scripts/part9/gates.sh
#   bash .../gates.sh --fast      (skip expo-doctor, which needs the network)
#
# The forbidden characters are produced with printf so that this script never
# contains them literally.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WAVE_DOCS="$(cd "$ROOT/.." && pwd)/docs/wave-sep18"
cd "$ROOT" || exit 2

fail=0
say() { printf '\n== %s\n' "$1"; }
hit() { echo "GATE FAILED: $1"; fail=1; }

say "tsc"
npx tsc --noEmit || hit "typecheck"

say "eslint (0 errors; the baseline has 9 warnings, do not add more)"
lint_out="$(npx eslint src 2>&1)"
echo "$lint_out" | tail -3
echo "$lint_out" | grep -qE "[1-9][0-9]* errors?\b" && ! echo "$lint_out" | grep -qE "\(0 errors" && hit "eslint errors"
warns="$(echo "$lint_out" | sed -nE 's/.*, ([0-9]+) warnings?\).*/\1/p' | tail -1)"
if [ -n "${warns:-}" ] && [ "$warns" -gt 9 ]; then hit "eslint warnings grew from 9 to $warns"; fi

EMDASH="$(printf '\342\200\224')"
MIDDOT_BRAND="$(printf 'Guest\302\267ly')"
SCAN="src docs store scripts .maestro locales README.md BUILD-LOG.md app.config.ts eas.json"

say "em dash"
out="$(grep -rn "$EMDASH" $SCAN 2>/dev/null)"; [ -n "$out" ] && { echo "$out" | head -20; hit "em dash in the app folder"; }
if [ -d "$WAVE_DOCS" ]; then
  out="$(grep -rn "$EMDASH" "$WAVE_DOCS" 2>/dev/null)"; [ -n "$out" ] && { echo "$out" | head -20; hit "em dash in docs/wave-sep18"; }
fi

say "brand spelling (middle dot)"
out="$(grep -rn "$MIDDOT_BRAND" $SCAN 2>/dev/null)"; [ -n "$out" ] && { echo "$out" | head; hit "middle dot brand spelling"; }
if [ -d "$WAVE_DOCS" ]; then
  out="$(grep -rn "$MIDDOT_BRAND" "$WAVE_DOCS" 2>/dev/null)"; [ -n "$out" ] && { echo "$out" | head; hit "middle dot brand spelling in docs/wave-sep18"; }
fi

say "purchase wording in src"
out="$(grep -rniE "stripe|checkout|upgrade|pricing" src)"; [ -n "$out" ] && { echo "$out" | head; hit "purchase wording"; }

say "Face ID wording in src"
out="$(grep -rnE "Face ID|FaceID" src)"; [ -n "$out" ] && { echo "$out" | head; hit "Face ID wording"; }

say "real tenant names in shipped, seeded or captured content"
out="$(grep -rniE "Alexandra|alexnico" src store .maestro scripts/part9 2>/dev/null | grep -v "scripts/part9/gates.sh")"; [ -n "$out" ] && { echo "$out" | head; hit "real tenant name"; }

say "tokens on disk (JWT shape; file names only, a match is never printed)"
# The web export under .part9/web inlines the PUBLIC Supabase anon key from .env by design.
# That one value is filtered out (read at run time); any other JWT is a hit.
ANON="$(grep "^EXPO_PUBLIC_SUPABASE_ANON_KEY=" .env 2>/dev/null | cut -d= -f2- | tr -d "\"'")"
out="$(grep -rIoE "eyJ[A-Za-z0-9_-]{20,}(\.[A-Za-z0-9_-]+){0,2}" .part9 docs store scripts .maestro 2>/dev/null | { if [ -n "$ANON" ]; then grep -vF -- "$ANON"; else cat; fi; } | cut -d: -f1 | sort -u)"; [ -n "$out" ] && { echo "$out" | head; hit "a token is on disk in the files above"; }

say "demo passwords on disk (values read at run time, never printed)"
if [ -f credentials/demo-accounts.env ]; then
  for key in PART9_COUPLE_PASSWORD PART9_PLANNER_PASSWORD; do
    val="$(grep "^$key=" credentials/demo-accounts.env | cut -d= -f2-)"
    if [ -n "$val" ]; then
      files="$(grep -rlF -- "$val" .part9 docs store scripts .maestro src "$WAVE_DOCS" 2>/dev/null)"
      [ -n "$files" ] && { echo "$files"; hit "$key value found in the files above"; }
    fi
  done
else
  echo "credentials/demo-accounts.env not present, skipped"
fi

say "feature copy parity (en and es key shapes)"
node "$HERE/copy-parity.mjs" || hit "feature copy parity"

if [ "${1:-}" != "--fast" ]; then
  say "expo-doctor (report; fix only what this wave caused)"
  npx expo-doctor 2>&1 | tail -15
fi

echo
if [ "$fail" -ne 0 ]; then echo "GATES: FAILED"; exit 1; fi
echo "GATES: all clean"
