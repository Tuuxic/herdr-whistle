#!/usr/bin/env bash
# Runs whistle's tests on Herdr's own engine: builds a throwaway test mod in a fresh temp folder
# and loads it with `herdr-app check` (ADR 0013), once per suite. A failing case throws, so the
# check fails and lists every failure. Exits non-zero on failure.
#
# One check per suite: `check` interrupts a mod whose loading runs longer than about half a
# second (seen on 0.1.15), and every suite runs while the test mod loads. Each suite's run time
# is printed, slowest first, so a suite nearing the limit shows before it flakes (split it).
#
# The test mod holds:
#   - the core's modules (CORE below: everything but the shell and the views) and the
#     helpers mods copy (HELPERS),
#   - tests/mod.json and every tests/*.js: main.js (the test mod), harness.js, shared data
#     (worlds.js) and the *.test.js suites,
#   - suites.js, written here: imports the suite that check runs and reports its load time,
#   - texts.js, written here: the text of each spec .md (docs/contracts/, docs/guide.md,
#     tests/fixtures/), mods/whistle/mod.json and mappings.json, keys.json, RECIPE.md and the core's sources, by repo path. Suites read
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
# The shared test mod, built once in base/ and copied for each suite.
base="$dir/base"
mkdir "$base"
for f in $CORE; do cp "$mod/$f" "$base/"; done
# Helpers other mods copy (they import herdr, so they aren't core): their suites import them.
HELPERS="whistle.js keynav.js"
for f in $HELPERS; do cp "$mod/$f" "$base/"; done
# The keynav checker's rules (kit/keynav-checker/): its suite runs them on whistle's keynav.js.
cp "$root/kit/keynav-checker/checks.js" "$base/"
cp "$here/mod.json" "$here"/*.js "$base/"

# texts.js: { "<repo path>": "<text>" }, each text as a template literal.
literal() { sed -e 's/\\/\\\\/g' -e 's/`/\\`/g' -e 's/\$/\\$/g' "$1"; }
(
  echo 'export default {'
  cd "$root" || exit 1
  for f in docs/contracts/*.md docs/guide.md tests/fixtures/*.md mods/whistle/mod.json mods/whistle/mappings.json keys.json RECIPE.md; do
    [ -f "$f" ] || continue
    printf '  "%s": `' "$f"; literal "$f"; echo '`,'
  done
  for f in $CORE; do printf '  "mods/whistle/%s": `' "$f"; literal "$mod/$f"; echo '`,'; done
  echo '};'
) > "$base/texts.js"

# One test mod per suite, checked JOBS at a time (default 1: checks side by side slow each other
# down toward the limit on a small CI runner). A new *.test.js gets its own check with no change
# here. Folders are numbered so they list in file order. suites.js imports t0.js (the clock)
# before the suite, so the time it reports covers the suite and the modules it pulls in.
JOBS="${JOBS:-1}"
i=0
printf 'globalThis.loadStart = Date.now();\n' > "$base/t0.js"
for f in "$here"/*.test.js; do
  one="$dir/run-$(printf '%03d' "$i")-$(basename "$f" .test.js)"
  cp -r "$base" "$one"
  printf 'import "./t0.js";\nimport s from "./%s";\nconsole.error(`load-ms ${Date.now() - globalThis.loadStart}`);\nexport default [s];\n' \
    "$(basename "$f")" > "$one/suites.js"
  i=$((i + 1))
done
# A failed check leaves its output in FAILED, printed below in suite order.
ls -d "$dir"/run-* | xargs -P "$JOBS" -I{} sh -c '
  "$1" check "$2" > "$2/out" 2>&1 || mv "$2/out" "$2/FAILED"
' sh "$app" {}
# Load times, slowest first; "-" for a suite cut short before it finished loading.
for one in "$dir"/run-*; do
  ms="$(cat "$one/out" "$one/FAILED" 2>/dev/null | sed -n 's/.*load-ms \([0-9]*\).*/\1/p' | head -1)"
  echo "${ms:--} ${one##*/run-???-}"
done | sort -rn | awk '{ all = all (NR > 1 ? ", " : "") $2 " " $1 } END { print "suite ms (of check'"'"'s ~500 ms load limit, parsing not counted), slowest first: " all }'
failed=()
for one in "$dir"/run-*; do
  name="${one##*/run-???-}"
  if [ -f "$one/FAILED" ]; then
    failed+=("$name")
    echo "FAIL $name"
    grep -v 'load-ms [0-9]' "$one/FAILED" | sed 's/^/     /'
  fi
done

# The keynav checker end to end (kit/keynav-checker/check.sh): it passes on whistle's own
# keynav.js, and fails saying why on a deliberately broken copy (tests/fixtures/keynav-broken/,
# whose announce writes v 1 entries) and on a folder with no keynav.js.
checker="$root/kit/keynav-checker/check.sh"
kit() { # kit pass <mod folder> | kit fail <mod folder> <text the output must hold>
  local got st
  got="$(bash "$checker" "$2" 2>&1)"; st=$?
  i=$((i + 1))
  if [ "$1" = pass ] && [ $st -eq 0 ]; then echo "PASS: keynav checker passes $2"; return; fi
  if [ "$1" = fail ] && [ $st -ne 0 ] && printf '%s\n' "$got" | grep -qF -- "$3"; then echo "PASS: keynav checker fails $2"; return; fi
  printf '%s\n' "$got"
  if [ "$1" = pass ]; then echo "FAIL: keynav checker should pass $2"
  else echo "FAIL: keynav checker should fail $2, saying: $3"; fi
  failed+=("keynav-checker:${2##*/}")
}
kit pass "$root/mods/whistle"
kit fail "$here/fixtures/keynav-broken" 'entry: announce wrote {"v":1,"label":"Check","keys":{"d":"Delete"}}'
kit fail "$here/fixtures" "no keynav.js in"

if [ ${#failed[@]} -eq 0 ]; then echo "PASS: whistle tests ($i checks)"; exit 0; fi
echo "FAIL: whistle tests (${#failed[@]} of $i checks: ${failed[*]})"
exit 1
