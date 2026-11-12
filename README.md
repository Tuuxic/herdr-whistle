# Whistle

Keyboard modes for [Herdr](https://herdr.dev): **TYPE** leaves the keyboard to your terminal,
**WHISTLE** (Ctrl+Space, or Ctrl+[ in a terminal) lets single keys move between the window's
fields and run mappings, with an optional which-key hints box. Inspired by vim; not vim.

## Install

Copy this folder to `~/.config/herdr-app/mods/whistle/` and merge `keys.json` into your
`~/.config/herdr-app/keys.json`. On a layout that doesn't place it, whistle docks itself as a
thin bar at the bottom.

## Keys in WHISTLE

| Key | Does |
|---|---|
| Ctrl+H/J/K/L | the field in that direction |
| h/j/k/l, arrows, Enter | move and open inside the field |
| i, Enter on a terminal | back to TYPE in the selected pane |
| Space | the leader group (Space w: whistle's settings) |

## Mappings

Three layers, each over the one before:

1. `mappings.json` here: defaults, Herdr's own commands only (an update replaces it)
2. the layout: the whistle block's `"mappings"` prop
3. `~/.config/herdr-app/whistle.json`: yours, `{ "enabled", "hints", "map" }`

A key set to `null` removes it. `mappings.json`'s `_help` lists the entry format.

## Fields: the keynav protocol

Whistle knows no other mod by name. The terminal is built in; any mod becomes a field by
taking part in **keynav** (`keynav.js`, copy it into your mod): it announces itself in
`shared("keynav.fields")`, draws its own cursor while `shared("keynav").active` names it, and
handles `<mod>.keynav-up|down|left|right|open|key-<char>` commands. Without a driver like
whistle, nothing shows.
