#!/usr/bin/env bash
# Try whistle in a Herdr home of its own, in a second Herdr window, without touching your own
# home (~/.config/herdr-app). Herdr picks its home from HERDR_APP_HOME; every command here sets it.
#
#   scripts/sandbox.sh reset [--whistle]  delete the sandbox, make a fresh home and open its window;
#                                         --whistle also copies this checkout's whistle in, merges
#                                         its keys.json and shows it in a layout `whistle-sandbox`
#   scripts/sandbox.sh open               open the sandbox window (the home must exist)
#   scripts/sandbox.sh close              close the sandbox window this script opened
#   scripts/sandbox.sh sync               copy this checkout's mods/whistle/ into the sandbox again
#   scripts/sandbox.sh agent [task]       start claude here with the sandbox as Herdr's home;
#                                         with no task, it installs whistle by RECIPE.md
#   scripts/sandbox.sh status             herdr-app status of the sandbox window
#   scripts/sandbox.sh path               print the sandbox folder
#
# Only the homes are apart: both windows show the same spaces, tabs and terminals (they run in
# hc), so test in a space of its own, and keys typed into a terminal reach that terminal.
# WHISTLE_SANDBOX picks the folder (default: ~/herdr-whistle-sandbox). Keep its path short: the
# window's socket lives in it, and Windows refuses a socket path of more than about 100 characters.
set -eu
repo="$(cd "$(dirname "$0")/.." && pwd)"
box="${WHISTLE_SANDBOX:-$HOME/herdr-whistle-sandbox}"
mark="$box/.whistle-sandbox"
die() { echo "sandbox: $*" >&2; exit 1; }
windows() { command -v cygpath >/dev/null; }
native() { if windows; then cygpath -w "$1"; else printf '%s\n' "$1"; fi; }
home_env() { HERDR_APP_HOME="$(native "$box")"; export HERDR_APP_HOME; }
running() { home_env; herdr-app status >/dev/null 2>&1; }
# Process ids of every Herdr window, yours too: the script only ever closes the one it opened.
app_pids() {
  if windows; then powershell -NoProfile -Command "(Get-Process herdr-app -ErrorAction SilentlyContinue).Id" | tr -d '\r'
  else pgrep -x herdr-app || true; fi
}

open_window() {
  [ -f "$mark" ] || die "no sandbox at $box; run: $0 reset"
  if running; then echo "The sandbox window is already open."; return; fi
  home_env
  before=" $(app_pids | tr '\n' ' ') "
  nohup herdr-app >/dev/null 2>&1 &
  disown
  for _ in $(seq 1 30); do running && break; sleep 1; done
  running || die "the sandbox window didn't answer within 30 s (herdr-app status)"
  # The new window's process: the one that wasn't there before (on Windows, $! is only bash's).
  for pid in $(app_pids); do case "$before" in *" $pid "*) ;; *) echo "$pid" > "$box/.pid" ;; esac; done
  echo "Sandbox window open, home $box"
}

close_window() {
  running || { echo "The sandbox window isn't open."; return; }
  [ -f "$box/.pid" ] || die "the window wasn't opened by this script; close it by hand"
  pid="$(cat "$box/.pid")"
  if windows; then taskkill //PID "$pid" >/dev/null 2>&1 || true; else kill "$pid" 2>/dev/null || true; fi
  for _ in $(seq 1 10); do running || break; sleep 1; done
  if running && windows; then taskkill //F //PID "$pid" >/dev/null 2>&1 || true; sleep 2; fi
  ! running || die "the sandbox window is still open; close it by hand"
  rm -f "$box/.pid"
  echo "Sandbox window closed."
}

copy_whistle() {
  rm -rf "${box:?}/mods/whistle"
  mkdir -p "$box/mods"
  cp -r "$repo/mods/whistle" "$box/mods/whistle"
  echo "Copied $repo/mods/whistle into the sandbox."
}

# Adds each key of the repo's keys.json to the sandbox's, section by section; a key the sandbox
# already binds keeps its binding (and is named). Like Install step 5, without asking.
merge_keys() {
  node -e '
    const fs = require("fs");
    const [from, to] = process.argv.slice(1);
    const add = JSON.parse(fs.readFileSync(from, "utf8"));
    const keys = fs.existsSync(to) ? JSON.parse(fs.readFileSync(to, "utf8")) : {};
    for (const [section, map] of Object.entries(add)) {
      keys[section] = keys[section] || {};
      for (const [key, action] of Object.entries(map)) {
        if (key in keys[section] && keys[section][key] !== action)
          console.log(`kept ${section} ${key}: ${keys[section][key]} (repo: ${action})`);
        else keys[section][key] = action;
      }
    }
    fs.writeFileSync(to, JSON.stringify(keys, null, 2) + "\n");
  ' "$(native "$repo/keys.json")" "$(native "$box/keys.json")"
  echo "Merged the repo's keys.json into the sandbox's."
}

# Herdr docks a new mod by itself only once its welcome is done, so the bar gets a layout: a clone
# of Herdr's main (block ids unchanged, so the shipped jump keys find agents and spaces) with a
# whistle anchor and bar under the status bar, as RECIPE.md's Install adds them.
show_whistle() {
  home_env
  herdr-app do layout.clone '{"name":"main","as":"whistle-sandbox"}' >/dev/null
  for _ in $(seq 1 10); do [ -f "$box/layouts/whistle-sandbox.json" ] && break; sleep 1; done
  node -e '
    const fs = require("fs"), f = process.argv[1], l = JSON.parse(fs.readFileSync(f, "utf8"));
    const find = (n) => n.id === "work" ? n : (n.children || []).map(find).find(Boolean);
    const work = find(l) || l;
    work.children.push({ id: "whistle-anchor", type: "block", size: { px: 0 }, resizable: false,
      content: { mod: "whistle", props: { anchor: true } } });
    work.children.push({ id: "whistle", type: "block", size: { px: 22 }, resizable: false,
      background: "chrome", content: { mod: "whistle" } });
    fs.writeFileSync(f, JSON.stringify(l, null, 2) + "\n");
  ' "$(native "$box/layouts/whistle-sandbox.json")"
  echo "Showing layout whistle-sandbox (Herdr's main with whistle's bar)."
}

case "${1:-}" in
  reset)
    real="$(cd "$HOME/.config/herdr-app" 2>/dev/null && pwd || true)"
    [ "$(cd "$box" 2>/dev/null && pwd || true)" != "$real" ] || die "$box is your own Herdr home"
    if [ -e "$box" ]; then
      [ -f "$mark" ] || die "$box exists but isn't a sandbox (no .whistle-sandbox); not deleting it"
      if running; then close_window; fi
      rm -rf "${box:?}"
    fi
    mkdir -p "$box"; : > "$mark"
    open_window
    # Herdr writes its own keys.json and stock mods on the first start; whistle goes in after.
    for _ in $(seq 1 30); do [ -f "$box/keys.json" ] && break; sleep 1; done
    if [ "${2:-}" = "--whistle" ]; then copy_whistle; merge_keys; show_whistle; fi
    ;;
  open) open_window ;;
  close) close_window ;;
  sync) [ -f "$mark" ] || die "no sandbox at $box"; copy_whistle ;;
  agent)
    [ -f "$mark" ] || die "no sandbox at $box; run: $0 reset"
    home_env
    shift
    task="${*:-Install whistle from $(native "$repo") by its RECIPE.md.}"
    exec claude "You work on a test Herdr home: $(native "$box"). HERDR_APP_HOME is set to it, so herdr-app talks to its window. Wherever RECIPE.md or Herdr's docs say Herdr's home or ~/.config/herdr-app, use that folder. Never read or change ~/.config/herdr-app itself. Its window shows the same spaces and terminals as the person's own window: never type into, close or kill a terminal you didn't start.
$task"
    ;;
  status) home_env; herdr-app status ;;
  path) echo "$box" ;;
  *) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
