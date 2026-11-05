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
  fonts                 # self-hosted woff2 and their OFL licenses (D4; cinematic/public/fonts).
                        # Required by the check below as soon as the page uses them; optional
                        # only so a push of source before its build still stages.
  .well-known           # apple-app-site-association and similar
  .nojekyll
  robots.txt            # crawler rules: allow all, points to the sitemap (cinematic/public).
                        # Optional so a push of source before its build still deploys.
  sitemap.xml           # public pages for search engines, written by cinematic/scripts/prerender.mjs
                        # from its route list (never /reunion, never a demo wedding)
  404.html
  reunion               # /reunion/<name>/: private session pages (noindex), one per planner call
  llms.txt              # AI facts file, EN (#48): written by cinematic/scripts/llms.mjs from the
                        # portal's docs/product/features.json, live and approved features only.
                        # Optional so a push of source before its build still stages; the
                        # build itself fails without it (check-seo.mjs), and the check below
                        # stages the three files together or not at all.
  llms-full.txt         # AI facts file, EN, with each feature's approved wording (#48, same generator)
  es                    # es/llms.txt only: the Spanish AI facts file (#48). Nothing else may
                        # live in es/ (checked below), so this entry cannot publish a page by accident.
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

# The AI facts files (#48) ship together or not at all, and es/ holds only
# the Spanish one.
llms_present=0
for f in llms.txt llms-full.txt es/llms.txt; do [ -f "$f" ] && llms_present=$((llms_present + 1)); done
if [ "$llms_present" != 0 ] && [ "$llms_present" != 3 ]; then
  echo "stage-site: llms.txt, llms-full.txt and es/llms.txt must be published together ($llms_present of 3 present); build cinematic and copy them in" >&2
  exit 1
fi
if [ -d es ]; then
  extra="$(find es -mindepth 1 ! -path es/llms.txt ! -name .DS_Store | head -1)"
  [ -z "$extra" ] || { echo "stage-site: es/ may hold only llms.txt, found $extra" >&2; exit 1; }
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

# Every /fonts/ file the staged pages or CSS name must be staged too, so a
# build that uses the self-hosted fonts never publishes without them.
missing_fonts=no
for f in $(grep -rhoE "/fonts/[A-Za-z0-9._-]+" "$OUT" --include='*.html' --include='*.css' | sort -u); do
  [ -f "$OUT$f" ] || { echo "stage-site: $f is used by the site but not staged (build cinematic and copy it in)" >&2; missing_fonts=yes; }
done
[ "$missing_fonts" = no ] || exit 1

find "$OUT" -name .DS_Store -delete
echo "stage-site: $(find "$OUT" -type f | wc -l | tr -d ' ') files staged in $OUT"
