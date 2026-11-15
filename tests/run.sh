#!/usr/bin/env bash
# Runs whistle's tests on Herdr's own engine: builds a throwaway test mod in a fresh temp folder
# and loads it with `herdr-app check` (ADR 0013), once per suite. A failing case throws, so the
# check fails and lists every failure. Exits non-zero on failure.
#
# One check per suite, run side by side: `check` interrupts a mod whose loading runs longer than
# about half a second (seen on 0.1.15), and every suite runs while the test mod loads.
#
# The test mod holds:
#   - the core's modules (CORE below: everything but the shell and the views) and the
#     helpers mods copy (HELPERS),
#   - tests/mod.json and every tests/*.js: main.js (the test mod), harness.js, shared data
#     (worlds.js) and the *.test.js suites,
#   - suites.js, written here: imports the suite that check runs,
#   - texts.js, written here: the text of each spec .md (docs/contracts/, docs/guide.md,
#     tests/fixtures/), mods/whistle/mod.json and mappings.json, keys.json and the core's sources, by repo path. Suites read
#     them from there: readTextFile is async, and `check` never sees an async failure.
#
# HERDR_APP picks the herdr-app to run (default: the one on PATH).
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
mod="$root/mods/whistle"
app="${HERDR_APP:-herdr-app}"

# The core: pure modules, no `herdr` import (a suite checks). Add a module here when it joins.
CORE="version.js keynames.js block.js fields.js inert.js claims.js config.js keymap.js views.js step.js"

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
for f in $CORE; do cp "$mod/$f" "$dir/"; done
# Helpers other mods copy (they import herdr, so they aren't core): their suites import them.
HELPERS="whistle.js keynav.js"
for f in $HELPERS; do cp "$mod/$f" "$dir/"; done
cp "$here/mod.json" "$here"/*.js "$dir/"

# texts.js: { "<repo path>": "<text>" }, each text as a template literal.
literal() { sed -e 's/\\/\\\\/g' -e 's/`/\\`/g' -e 's/\$/\\$/g' "$1"; }
(
  echo 'export default {'
  cd "$root" || exit 1
  for f in docs/contracts/*.md docs/guide.md tests/fixtures/*.md mods/whistle/mod.json mods/whistle/mappings.json keys.json; do
    [ -f "$f" ] || continue
    printf '  "%s": `' "$f"; literal "$f"; echo '`,'
  done
  for f in $CORE; do printf '  "mods/whistle/%s": `' "$f"; literal "$mod/$f"; echo '`,'; done
  echo '};'
) > "$dir/texts.js"

# One test mod per suite (suites.js imports just that one), checked side by side.
JOBS="${JOBS:-6}"
i=0
for f in "$here"/*.test.js; do
  one="$dir/run-$i"
  mkdir "$one"
  find "$dir" -maxdepth 1 -type f -exec cp {} "$one/" \;
  printf 'import s from "./%s";\nexport default [s];\n' "$(basename "$f")" > "$one/suites.js"
  i=$((i + 1))
done
# A failed check leaves its output in FAILED, listed below in suite order.
ls -d "$dir"/run-* | xargs -P "$JOBS" -I{} sh -c '
  "$1" check "$2" > "$2/out" 2>&1 || mv "$2/out" "$2/FAILED"
' sh "$app" {}
status=0
for one in "$dir"/run-*; do
  if [ -f "$one/FAILED" ]; then cat "$one/FAILED"; status=1; fi
done
if [ $status -eq 0 ]; then echo "PASS: whistle tests ($i suites)"
else echo "FAIL: whistle tests"; fi
exit $status
