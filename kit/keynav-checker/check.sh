#!/usr/bin/env bash
# Checks a field mod's keynav.js against keynav v3 (docs/contracts/keynav.md):
#
#   bash kit/keynav-checker/check.sh path/to/your-mod
#
# Builds a throwaway mod in a temp folder from this kit and your mod's keynav.js, and loads it
# with `herdr-app check`; the kit plays the driver and lists every rule your copy breaks.
# Exits 0 when it passes. HERDR_APP picks the herdr-app to run (default: the one on PATH).
set -u
kit="$(cd "$(dirname "$0")" && pwd)"
app="${HERDR_APP:-herdr-app}"
if [ $# -ne 1 ]; then echo "usage: bash check.sh <your mod's folder>" >&2; exit 2; fi
target="$1"
if [ ! -f "$target/keynav.js" ]; then
  echo "FAIL: no keynav.js in $target: copy whistle's mods/whistle/keynav.js into your mod's folder" >&2
  exit 1
fi

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
cp "$kit/mod.json" "$kit/main.js" "$kit/checks.js" "$dir/"
cp "$target/keynav.js" "$dir/"

out="$("$app" check "$dir" 2>&1)"
status=$?
if [ $status -eq 0 ]; then echo "PASS: $target/keynav.js speaks keynav v3"
else printf '%s\n' "$out"; echo "FAIL: $target/keynav.js ($app check exit $status)"; fi
exit $status
