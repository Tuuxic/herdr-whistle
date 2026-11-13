#!/usr/bin/env bash
# Runs the keymap tests: copies the pure modules from mods/whistle and the test mod from tests/
# into a fresh temp folder, loads it with `herdr-app check` (a failing case throws, so the load
# fails with every failure listed), prints the result and exits non-zero on failure.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
mod="$here/../mods/whistle"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
cp "$mod/config.js" "$mod/keynames.js" "$mod/keymap.js" "$dir/"
cp "$here/main.js" "$here/mod.json" "$here/keymap.test.js" "$dir/"
out="$(herdr-app check "$dir" 2>&1)"
status=$?
[ -n "$out" ] && printf '%s\n' "$out"
if [ $status -eq 0 ]; then echo "PASS: keymap tests"
else echo "FAIL: keymap tests (herdr-app check exit $status)"; fi
exit $status
