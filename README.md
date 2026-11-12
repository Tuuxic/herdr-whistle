# Whistle

A vim-inspired mode for [Herdr](https://herdr.dev): switch out of typing to navigate and
control the whole interface with simple key sequences.

Like vim, it has two modes. In **TYPE** the keyboard belongs to your terminal, as usual. Press
Ctrl+Space (or Ctrl+[ in a terminal) and you're in **WHISTLE**: single keys move between
spaces, agents, tabs, panes and side panels, and short sequences run commands (Space p opens
the palette, w v splits a pane). A hints box lists the keys that can follow. Press i to type
again.

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
2. the layout: the whistle block's `"mappings"` prop, and its `"enabled"` / `"hints"` props
   (a layout can ship whistle switched off)
3. `~/.config/herdr-app/whistle.json`: yours, `{ "enabled", "hints", "bar", "map" }`

A layout can offer more than one spot for the bar: give each whistle block a `"bar"` prop
with a name and hide all but one. Whistle's settings then let you pick where it goes.

A key set to `null` removes it. `mappings.json`'s `_help` lists the entry format.

## Fields: the keynav protocol

Whistle knows no other mod by name. The terminal is built in; any mod becomes a field by
taking part in **keynav** (`keynav.js`, copy it into your mod): it announces itself in
`shared("keynav.fields")`, draws its own cursor while `shared("keynav").active` names it, and
handles `<mod>.keynav-up|down|left|right|open|key-<char>` commands. Without a driver like
whistle, nothing shows.

## License

MIT (`LICENSE`).
