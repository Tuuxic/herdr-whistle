#!/usr/bin/env bash
# Runs whistle's tests on Herdr's own engine: builds a throwaway test mod in a fresh temp folder
# and loads it with `herdr-app check` (ADR 0003), once per suite. A failing case throws, so the
# check fails and lists every failure. Exits non-zero on failure.
#
# One check per suite: `check` interrupts a mod whose loading runs longer than about half a
# second (seen on 0.1.15), and every suite runs while the test mod loads. Each suite's run time
# is printed, slowest first, so a suite nearing the limit shows before it flakes (split it).
#
# The test mod holds:
#   - the core's modules (CORE below: everything but the shell and the views), whistle-ui's
#     core in ui/ (UI_CORE) and the helpers mods copy (HELPERS),
#   - tests/mod.json and every tests/*.js: main.js (the test mod), harness.js, shared data
#     (worlds.js) and the *.test.js suites,
#   - suites.js, written here: imports the suite that check runs and reports its load time,
#   - texts.js, written here: the text of each spec .md (docs/contracts/, docs/guide.md,
#     tests/fixtures/), the other docs (README, CHANGELOG, CONTRIBUTING, docs/authors.md, the
#     checker's README), the workflows, mods/whistle/mod.json, mappings.json and whistle.js,
#     whistle-ui's mod.json and keys.json, keys.json, RECIPE.md and both cores' sources, by repo path, plus `files`, every file in the repo.
#     Suites read them from there: readTextFile is async, and `check` never sees an async failure.
#
# HERDR_APP picks the herdr-app to run (default: the one on PATH).
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
mod="$root/mods/whistle"
app="${HERDR_APP:-herdr-app}"

# The core: pure modules, no `herdr` import (a suite checks). Add a module here when it joins.
CORE="version.js keynames.js block.js fields.js inert.js claims.js config.js keymap.js facts.js step.js"

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
# The shared test mod, built once in base/ and copied for each suite.
base="$dir/base"
mkdir "$base"
for f in $CORE; do cp "$mod/$f" "$base/"; done
# whistle-ui's core (mods/whistle-ui/, a client of whistle's public keys): pure like whistle's,
# copied into base/ui/ so its names don't clash with whistle's. Add a module here when it joins.
UI="mods/whistle-ui"
UI_CORE="read.js box.js ui.js"
mkdir "$base/ui"
for f in $UI_CORE; do cp "$root/$UI/$f" "$base/ui/"; done
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
  for f in docs/contracts/*.md docs/guide.md docs/authors.md tests/fixtures/*.md mods/whistle/mod.json mods/whistle/mappings.json \
      mods/whistle/whistle.js "$UI/mod.json" "$UI/keys.json" keys.json RECIPE.md README.md CHANGELOG.md CONTRIBUTING.md kit/keynav-checker/README.md .github/workflows/*.yml; do
    [ -f "$f" ] || continue
    printf '  "%s": `' "$f"; literal "$f"; echo '`,'
  done
  for f in $CORE; do printf '  "mods/whistle/%s": `' "$f"; literal "$mod/$f"; echo '`,'; done
  for f in $UI_CORE; do printf '  "%s/%s": `' "$UI" "$f"; literal "$UI/$f"; echo '`,'; done
  echo '};'
  # Every file in the repo (tracked or new, not ignored), so links in the docs can be checked.
  echo 'export const files = ['
  { git ls-files --cached --others --exclude-standard 2>/dev/null || find . -type f ! -path './.git/*' | sed 's|^\./||'; } \
    | sort -u | sed 's/.*/  "&",/'
  echo '];'
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

# The release (.github/workflows/release.yml) through scripts/release.sh: the version it tags is
# version.js's (which mod.json repeats), and its notes are that version's CHANGELOG entry, without
# the heading, up to the next entry (a `## ` line in a code fence isn't one).
release="$root/scripts/release.sh"
rel() { # rel <name> <wanted output> <release.sh args...>: output and exit 0, or "fails" for a non-zero exit
  local name="$1" want="$2" got st
  shift 2
  got="$(bash "$release" "$@" 2>/dev/null)"; st=$?
  i=$((i + 1))
  if [ "$want" = fails ] && [ $st -ne 0 ]; then echo "PASS: release: $name"; return; fi
  if [ "$want" != fails ] && [ $st -eq 0 ] && [ "$got" = "$want" ]; then echo "PASS: release: $name"; return; fi
  printf 'got (exit %s):\n%s\n' "$st" "$got"
  echo "FAIL: release: $name"
  failed+=("release:$name")
}
rel "the version is mod.json's" "$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$mod/mod.json")" version
rel "notes are the version's entry" "$(tr -d '\r' < "$here/fixtures/release/notes-1.2.0.md")" notes 1.2.0 "$here/fixtures/release/CHANGELOG.md"
rel "the last entry's notes end at the file's end" "$(printf '### You\n\n- Older.')" notes 1.1.0 "$here/fixtures/release/CHANGELOG.md"
rel "a version without an entry fails" fails notes 9.9.9 "$here/fixtures/release/CHANGELOG.md"
i=$((i + 1))
if [ "$(bash "$release" notes "$(bash "$release" version)" 2>&1 | head -1)" = "### Upgrading" ]; then
  echo "PASS: release: CHANGELOG.md's notes for this version start with its Upgrading note"
else echo "FAIL: release: CHANGELOG.md has no notes for this version starting with ### Upgrading"; failed+=("release:changelog"); fi

if [ ${#failed[@]} -eq 0 ]; then echo "PASS: whistle tests ($i checks)"; exit 0; fi
echo "FAIL: whistle tests (${#failed[@]} of $i checks: ${failed[*]})"
exit 1
