#!/usr/bin/env bash
# Renders index.html (1600x1000) to ../preview.png with headless Chrome, Edge or Chromium.
# Needs network once for the JetBrains Mono font from Google Fonts.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
for c in "${CHROME:-}" google-chrome chromium chromium-browser \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"; do
  [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 && { chrome=$c; break; }
done
[ -n "${chrome:-}" ] || { echo "No Chrome/Edge/Chromium found; set CHROME=/path/to/it" >&2; exit 1; }
dir=$here; command -v cygpath >/dev/null && dir=$(cygpath -m "$here")
profile=$(mktemp -d)
"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1600,1000 --virtual-time-budget=5000 --user-data-dir="$profile" \
  --screenshot="$dir/../preview.png" "file:///${dir#/}/index.html" 2>/dev/null
rm -rf "$profile"
echo "Wrote $here/../preview.png"
