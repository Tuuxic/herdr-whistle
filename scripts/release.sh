#!/usr/bin/env bash
# What the release workflow (.github/workflows/release.yml) tags and publishes:
#
#   scripts/release.sh version                  whistle's version, VERSION in mods/whistle/version.js
#   scripts/release.sh notes <version> [file]   that version's entry in CHANGELOG.md (or file),
#                                               without its `## v<version> (...)` heading, up to
#                                               the next entry; fails when there is none
#
# tests/run.sh checks both.
set -eu
repo="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  version)
    sed -n 's/^export const VERSION = "\([^"]*\)";.*/\1/p' "$repo/mods/whistle/version.js" | tr -d '\r' | grep .
    ;;
  notes)
    [ $# -ge 2 ] || { echo "usage: $0 notes <version> [changelog]" >&2; exit 2; }
    tr -d '\r' < "${3:-$repo/CHANGELOG.md}" | awk -v v="$2" '
      /^(```|~~~)/ { fence = !fence }
      !fence && /^## / { if (inside) exit; if (index($0, "## v" v " ") == 1 || $0 == "## v" v) { inside = 1; found = 1; next } }
      inside { lines[++n] = $0 }
      END {
        if (!found) { print "no entry for v" v > "/dev/stderr"; exit 1 }
        first = 1; while (first <= n && lines[first] == "") first++
        last = n; while (last >= first && lines[last] == "") last--
        for (k = first; k <= last; k++) print lines[k]
      }'
    ;;
  *)
    echo "usage: $0 version | notes <version> [changelog]" >&2
    exit 2
    ;;
esac
