# Whistle

A vim-inspired mode for Herdr: switch out of typing to move around the window with single
keys. A thin bar shows which mode you're in: **TYPE**, where the keyboard belongs to the
terminal as usual, or **WHISTLE**, where whistle holds it.

> **Agents:** install, update and uninstall whistle by the [Install](#install),
> [Update](#update) and [Uninstall](#uninstall) sections at the end, not by AGENTS.md's add
> steps: re-adding makes a renamed second copy, which only stands aside.

![Whistle](preview.png)

## What you see

- **Bar** (a block the layout places, else docked at the bottom, 22 px, on `chrome`, text
  11.5 px): on the left a mode badge, bold, 10 px side padding: **TYPE** on the theme's
  `done` color or **WHISTLE** on `accent`, text in `background`. Then, 10 px on, in `muted`,
  what has the keyboard: `Terminal`, or in WHISTLE `Terminal · <pane title>` (up to 40
  characters). A flash (a failed command, `w x is not mapped`) takes the label until the
  next key. While there are config problems, the bar ends with a marker in `blocked`, 10 px
  in from the right: `⚠ <count>`.
- **Inert**: no badge, only why, in the `blocked` color, 10 px in from the left:
  `Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)`, or on a second copy
  `Another whistle runs, from mods/whistle/` (that copy's bar hides itself, so it shows only
  if someone shows it again).

## How it behaves

- **Modes**: `ctrl-space` (keys.json `global`, `whistle.whistle`) enters WHISTLE on the
  terminal pane the keyboard just left; `ctrl-space` again (`mod:whistle`, `whistle.type`),
  `i` or Enter go back to TYPE in the selected pane. A click anywhere else ends WHISTLE; a
  click on the bar enters it.
- **Moving** (the default own keys): `ctrl-h/j/k/l` select the field in that direction (for
  now, terminal blocks); `h/j/k/l` and the arrows move between the selected terminal's split
  panes.
- **Config** (ADR 0004): layers, each over the one before: `mods/whistle/mappings.json` (the
  defaults), the layout's whistle block (`mappings` and `keys` props, the first block of this
  copy that has each), and `whistle.json` in Herdr's home. `map`: key → `[label, command,
  args?, "type"?]` or a group `{ name, map }` (nested; groups merge key by key); `keys`: own-key
  action → list of keys. `null` takes a key or action away. Outside a key sequence a mapping
  goes over an own key; in one, `cancel` ends it, `back` goes up a level, an unmapped key
  flashes `<keys> is not mapped`. A mapping runs its command (`pane.*`/`terminal.*` on the
  selected pane first), then the bar holds the keyboard for 600 ms, except for commands that
  take it themselves (`mod.open`, `app.*`, renames).
- **Failure** (issue #10): a file that doesn't parse runs on its last good version from this
  session; with none, whistle.json is left out and a missing or broken mappings.json gives the
  safety own keys built into `config.js` (`SAFETY`), a broken install. Every entry is checked
  (key names via `canonicalKey`, commands against Herdr's `commands()`, where a name outside
  Herdr's namespaces is a mod's command); a bad one is skipped and listed. Config problems are
  `model.problems` (`problems(model)` adds keys.json's). A command Herdr refuses when pressed
  only flashes. keys.json isn't written while whistle's files aren't read yet, either doesn't
  parse, or mappings.json is missing.
- **Claimed keys** (ADR 0001): whistle keeps its keys in keys.json's `mod:whistle` section
  (`mod:<folder>` for a renamed copy) as `"<key>": "whistle.key-<key>"`: every chord among its
  own keys, and any other own key the `global` section or the shown layout's section binds.
  Keys compare by canonical name (`keynames.js` `canonicalKey`: cmd/win/super are one
  modifier, `secondary` is cmd on macOS and ctrl elsewhere, modifiers in any order and case,
  an uppercase letter in a chord is shift). Entries of another form are the person's and win.
  It writes only when the section would change, one write at a time, never while keys.error
  exists or when there is no keys.json, and never while inert. 600 ms after a write it looks
  for keys.error; if Herdr rejected the text it writes the old text back and doesn't retry
  that text. A failed write is kept as a problem (`model.claimProblem`) and not retried until
  keys.json changes. `whistle.key-<key>` acts as the key pressed on the bar.
- **Inert**: on a Herdr older than the minimum in `version.js` (`updates().app.version`, or
  when that can't be read), or while another copy of whistle runs, whistle stands aside:
  WHISTLE never starts, keys and clicks on the bar do nothing, and the key keys.json binds to
  `whistle.whistle` (as it resolves from a terminal: `terminal`, then a layout's section,
  then `global`) is typed into the focused terminal instead. If WHISTLE was on, it goes back
  to TYPE first.
- **Copies**: each copy announces its folder in `shared("whistle.copies")`. Of this copy
  and the announced copies with a block in the shown layout, the one in `mods/whistle/`
  runs, else the first folder by name. The others are inert, hide their bars with
  `layout.hide` (only bars that were showing), and show them again once they run.
- **Whistle state**: the running copy publishes `shared("whistle") = { v: 1, mode, enabled,
  sequence, pane }` whenever it changes, and only then; an inert copy never writes it
  (docs/contracts/state.md). Every other `whistle.*` key is private.
- **Keynav fields**: a mod's block is a field once its entry `shared("keynav.field:<field
  key>")` says `v: 2`. Whistle names the selected one in `shared("keynav") = { v: 2, active }`,
  sends it moves and its declared keys as `<mod>.keynav-*` commands, and reads its request slot
  `shared("keynav.request:<field key>")`. Declared keys beat mappings but not own keys
  (docs/contracts/keynav.md).

## Built from

- **`mods/whistle/`**: a pure core, `step(model, input, world) -> { model, effects }`
  (`step.js`, with `fields.js` for the layout's fields, `inert.js` for the inert gate,
  `claims.js` for the keys.json section it wants, `config.js` for the layers, `keymap.js`
  for what a key means, `keynames.js`, `version.js`), behind one shell, `main.js`, that reads Herdr into `world`,
  feeds commands, key presses and a 120 ms tick through `step`, and carries out the effects;
  `bar.js` draws the bar. `whistle.js` is the reader other mods copy (whistle doesn't import
  it), and `keynav.js` the helper keynav fields copy. `mod.json`: `place: bottom`, size 22, `focusable: true`, and
  `version` / `herdr` repeating `version.js`.
- **`version.js`**: `VERSION`, `MIN_HERDR` and `HOME` (`"mods/whistle/"`, the copy's own
  folder; Herdr's add procedure rewrites it when it renames a copy).
- **`keys.json`** (repo root): `global: ctrl-space → whistle.whistle`,
  `mod:whistle: ctrl-space → whistle.type`.
- **Herdr**: `layout()`, `focused()`, `panes()`, `keys()`, `updates()`, `window()`, `commands()`, `theme()`,
  `shared`/`setShared`, `nextCommand()`, `run` (`pane.focus`, `pane.go`, `layout.hide`,
  `layout.show`), `exec("hc", ["keys", ...])` to type the switch key through while inert.
  `readTextFile` / `writeTextFile` on `appHome()`'s `keys.json` (read every second, written
  with the text it read as `expected`) and `keys.error`, and reads `whistle.json` there
  every second. No network; no other files outside its folder.
- **Tests**: `bash tests/run.sh` (`herdr-app check` on a throwaway test mod); not shipped.

## Watch out

- `updates()`, `keys()` and `commands()` are read through `import * as herdr`, so a Herdr without them
  still loads whistle, which then stands aside instead of failing to load.
- A copy counts only while it has a block in the shown layout: a copy whose block is gone
  doesn't keep another copy inert.
- Herdr can hand the keyboard back to a pane late after a command: after a pane move whistle
  holds the keyboard for 600 ms.

## Done when

- The bar shows a TYPE badge; `ctrl-space` turns it into WHISTLE with `Terminal · <title>`,
  `ctrl-space` again (or `i`) goes back.
- With `mods/whistle/` and a copy in `mods/whistle-2/` both in the layout, the copy's bar
  hides itself and `mods/whistle/` runs.
- A `whistle.json` mapping `n` to `["Next tab", "tab.next"]` works in WHISTLE; breaking its
  JSON keeps `n` working and puts `⚠ 1` at the bar's end; fixing it takes the marker away.
- With `MIN_HERDR` set above Herdr's version, the bar says which Herdr whistle needs and
  `ctrl-space` reaches the terminal.

## Install

1. Read this recipe and every file in `mods/whistle/` first. Tell the person that whistle
   runs `hc` (to type a key into a terminal), writes only its own entries in keys.json's
   `mod:whistle` section, reads `whistle.json` (their own config) without writing it, and
   uses no network.
2. Check Herdr's version (`herdr-app --version`) against `"herdr"` in `mods/whistle/mod.json`.
   If Herdr is older, say whistle will stay inert until Herdr is updated.
3. Look for a whistle already there: any `mods/*/mod.json` with `"title": "Whistle"`. If
   there is one, follow [Update](#update) instead.
4. Copy `mods/whistle/` to `mods/whistle/`. If another mod already has that name, ask the
   person before renaming either; a renamed whistle needs `HOME` in its `version.js`
   rewritten to its folder, and a copy in `mods/whistle/` always wins over it.
5. Merge the repo's `keys.json` into the person's: add its sections and keys, and ask before
   replacing a key they already use.
6. `herdr-app check mods/whistle`.

## Update

Update in place: whistle never shows an "updated" notice, so what changed reaches the person
only through you.

1. Find every copy: each `mods/*/mod.json` with `"title": "Whistle"`. The old version is
   `"version"` in the copy's `mod.json`. **A copy without `version.js` is older than 1.0:
   also apply v1.0.0's Upgrading note in `CHANGELOG.md` in full.**
2. Replace the contents of `mods/whistle/` with the new `mods/whistle/`: copy every file over
   and delete the files the new version doesn't ship. Don't rename anything. If the only
   copy is in another folder, move it to `mods/whistle/` and update it there.
3. Other copies stay inert while `mods/whistle/` runs. Ask before deleting them.
4. Never touch `~/.config/herdr-app/whistle.json`, and don't merge `keys.json` again:
   whistle reconciles its own `mod:whistle` keys. Change keys.json only where an Upgrading
   note says to.
5. Read `CHANGELOG.md` and tell the person about every entry newer than the old version,
   breaking ones first; follow each entry's **Upgrading** note.
6. `herdr-app check mods/whistle`.

## Uninstall

1. Delete every copy (each `mods/*/` whose `mod.json` has `"title": "Whistle"`).
2. In keys.json, remove the `mod:whistle` section and every binding to a `whistle.*` action.
3. Ask before deleting `~/.config/herdr-app/whistle.json`, the person's own settings.
4. Tell the person that whistle blocks in their layouts will now show nothing, and offer to
   remove them.
