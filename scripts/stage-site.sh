#!/usr/bin/env bash
# Stage the public website for GitHub Pages.
#
# guest-ly.com publishes ONLY what this allowlist names. Everything else in the
# repository (internal notes, plans, the mobile app, scripts, screenshots,
# cinematic/ source) stays out of the site by default. To publish a new public
# file, add it to REQUIRED or OPTIONAL below with the reason it must be public.
#
# Usage: scripts/stage-site.sh [out_dir]   (default: _site)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-_site}"
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac

# Must exist, or the deploy stops.
REQUIRED=(
  index.html            # landing page (cinematic build, prerendered)
  privacy/index.html    # /privacy (prerendered; linked by the site, app and store listing)
  terms/index.html      # /terms (prerendered; linked by the site, app and store listing)
  refunds/index.html    # /refunds (prerendered; linked by the site)
  assets                # Vite JS and CSS chunks loaded by every page
  textures              # textures/silk.jpg, loaded by the WebGL stage
  favicon-diamond.svg   # favicon linked by every page
  favicon.svg           # cinematic/public brand file, shipped with the build
  icons.svg             # cinematic/public brand file, shipped with the build
  guest-ly-black.svg    # cinematic/public brand file, shipped with the build
  guest-ly-white.svg    # cinematic/public brand file, shipped with the build
  logos                 # og:image and twitter:image (logos/png/guest-ly-on-navy.png),
                        # email signature logo (logos/png/guest-ly-black.png)
  CNAME                 # custom domain guest-ly.com
)

# Standard web-root files: published when present, skipped when absent.
OPTIONAL=(
  .well-known           # apple-app-site-association and similar
  .nojekyll
  robots.txt
  sitemap.xml
  404.html
)

cd "$ROOT"

# Every file the cinematic build ships from public/ must be allowlisted, so a
# new public asset is never silently left off the site.
if [ -d cinematic/public ]; then
  for entry in cinematic/public/* cinematic/public/.[!.]*; do
    [ -e "$entry" ] || continue
    name="$(basename "$entry")"
    listed=no
    for p in "${REQUIRED[@]}" "${OPTIONAL[@]}"; do [ "$p" = "$name" ] && listed=yes; done
    [ "$listed" = yes ] || { echo "stage-site: cinematic/public/$name is not in the allowlist in scripts/stage-site.sh" >&2; exit 1; }
  done
fi
# Same for every page the prerender step writes (dist/<route>/index.html).
if [ -f cinematic/scripts/prerender.mjs ]; then
  for page in $(grep -oE "'[A-Za-z0-9_/-]+/index\.html'" cinematic/scripts/prerender.mjs | tr -d "'"); do
    listed=no
    for p in "${REQUIRED[@]}"; do [ "$p" = "$page" ] && listed=yes; done
    [ "$listed" = yes ] || { echo "stage-site: prerendered page $page is not in the allowlist in scripts/stage-site.sh" >&2; exit 1; }
  done
fi

rm -rf "$OUT"
mkdir -p "$OUT"

copy() {
  mkdir -p "$OUT/$(dirname "$1")"
  cp -R "$1" "$OUT/$1"
}

for p in "${REQUIRED[@]}"; do
  [ -e "$p" ] || { echo "stage-site: required path missing: $p" >&2; exit 1; }
  copy "$p"
done
for p in "${OPTIONAL[@]}"; do
  [ -e "$p" ] && copy "$p"
done

find "$OUT" -name .DS_Store -delete
echo "stage-site: $(find "$OUT" -type f | wc -l | tr -d ' ') files staged in $OUT"
