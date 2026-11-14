#!/usr/bin/env bash
# Runs whistle's tests on Herdr's own engine: builds a throwaway test mod in a fresh temp folder
# and loads it with `herdr-app check` (ADR 0013). A failing case throws, so the check fails and
# lists every failure, grouped by suite. Exits non-zero on failure.
#
# The test mod holds:
#   - the core's modules (CORE below: everything but the shell and the views) and the
#     helpers mods copy (HELPERS),
#   - tests/mod.json and every tests/*.js: main.js (the test mod), harness.js, shared data
#     (worlds.js) and the *.test.js suites,
#   - suites.js, written here: imports every suite,
#   - texts.js, written here: the text of each spec .md (docs/contracts/, docs/guide.md,
#     tests/fixtures/), mods/whistle/mod.json and mappings.json and the core's sources, by repo path. Suites read
#     them from there: readTextFile is async, and `check` never sees an async failure.
#
# HERDR_APP picks the herdr-app to run (default: the one on PATH).
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
mod="$root/mods/whistle"
app="${HERDR_APP:-herdr-app}"

# The core: pure modules, no `herdr` import (a suite checks). Add a module here when it joins.
CORE="version.js keynames.js block.js fields.js inert.js claims.js config.js keymap.js step.js"

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
for f in $CORE; do cp "$mod/$f" "$dir/"; done
# Helpers other mods copy (they import herdr, so they aren't core): their suites import them.
HELPERS="whistle.js"
for f in $HELPERS; do cp "$mod/$f" "$dir/"; done
cp "$here/mod.json" "$here"/*.js "$dir/"

# suites.js: every suite, in file order.
{
  i=0
  for f in "$here"/*.test.js; do echo "import s$i from \"./$(basename "$f")\";"; i=$((i + 1)); done
  printf 'export default ['
  for ((j = 0; j < i; j++)); do printf 's%d, ' "$j"; done
  echo '];'
} > "$dir/suites.js"

# texts.js: { "<repo path>": "<text>" }, each text as a template literal.
literal() { sed -e 's/\\/\\\\/g' -e 's/`/\\`/g' -e 's/\$/\\$/g' "$1"; }
(
  echo 'export default {'
  cd "$root" || exit 1
  for f in docs/contracts/*.md docs/guide.md tests/fixtures/*.md mods/whistle/mod.json mods/whistle/mappings.json; do
    [ -f "$f" ] || continue
    printf '  "%s": `' "$f"; literal "$f"; echo '`,'
  done
  for f in $CORE; do printf '  "mods/whistle/%s": `' "$f"; literal "$mod/$f"; echo '`,'; done
  echo '};'
) > "$dir/texts.js"

out="$("$app" check "$dir" 2>&1)"
status=$?
[ -n "$out" ] && printf '%s\n' "$out"
if [ $status -eq 0 ]; then echo "PASS: whistle tests"
else echo "FAIL: whistle tests ($app check exit $status)"; fi
exit $status
