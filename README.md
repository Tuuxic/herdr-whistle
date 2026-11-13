# Whistle

A vim-inspired mode for [Herdr](https://herdr.dev): switch out of typing to navigate and
control the whole interface with simple key sequences.

Like vim, it has two modes. In **TYPE** the keyboard belongs to your terminal, as usual. Press
Ctrl+Space (or Ctrl+[ in a terminal) and you're in **WHISTLE**: single keys move between
spaces, agents, tabs, panes and side panels, and short sequences run commands (p opens the
palette, w v splits a pane). A hints box lists the keys that can follow. Press i to type
again.

## Install

Copy `mods/whistle/` to `~/.config/herdr-app/mods/whistle/` and merge `keys.json` into your
`~/.config/herdr-app/keys.json`. On a layout that doesn't place it, whistle docks itself as a
thin bar at the bottom.

## Keys in WHISTLE

Defaults; all of them can be changed (see Mappings).

| Key | Does |
|---|---|
| Ctrl+H/J/K/L | the field in that direction |
| h/j/k/l, arrows, Enter | move and open inside the field |
| i, Enter on a terminal | back to TYPE in the selected pane |
| p, `,`, ? | palette, settings, keys |
| t, w, S | the Tabs, Panes and Spaces groups (w v splits right) |
| Esc, Backspace | cancel a key sequence, go back one level |

Entering and leaving are regular keys in `keys.json`: `whistle.whistle` switches (Ctrl+Space),
`whistle.enter` only enters (Ctrl+[ in a terminal), `whistle.type` only leaves.

## Mappings

Three layers, each over the one before:

1. `mods/whistle/mappings.json`: defaults, Herdr's own commands only (an update replaces it)
2. the layout: the whistle block's `"mappings"` prop, and its `"enabled"` / `"hints"` props
   (a layout can ship whistle switched off)
3. `~/.config/herdr-app/whistle.json`: yours, `{ "enabled", "hints", "bar", "keys", "map" }`

`"map"` holds the mappings, `"keys"` whistle's own keys (action → keys, e.g.
`"type": ["i"]`; your list replaces the default one; `null` removes the action).

**Whistle edits your `keys.json`.** Herdr runs `keys.json` before whistle sees a key, so a key
another section binds (a layout's Ctrl+H) would never reach it. Whistle claims those keys in
the `"mod:whistle"` section, as `"<key>": "whistle.key-<key>"`: every Ctrl/Alt/Super chord in
its config, and any other of its keys a global or layout section binds. It writes only when
those entries change, never touches your own entries there, leaves the file alone while
`keys.error` reports a problem, and puts the old text back if Herdr rejects the new one.
Herdr stops adding new default shortcuts to a `keys.json` that was edited.

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
