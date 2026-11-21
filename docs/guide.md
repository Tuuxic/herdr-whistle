# Whistle guide

## Modes and the switch key

Whistle has two modes. In **TYPE** the keyboard belongs to the focused terminal or app, as
usual. In **WHISTLE** whistle holds it: keys move between fields and run mappings.

`ctrl-space` is the switch key, both ways. Besides it, whistle ships only two jump keys for TYPE
(`alt-a` and `alt-s`, below) and `alt-,` for [its settings](#settings): the rest of
whistle's defaults act only in WHISTLE, so TYPE stays yours. Herdr's `keys.json` holds them:

```json
"global": { "ctrl-space": "whistle.switch-mode", "alt-a": "whistle.focus:agents", "alt-s": "whistle.focus:spaces",
            "alt-,": "whistle.settings" },
"mod:whistle": { "ctrl-space": "whistle.mode:type" }
```

Ctrl+Space is taken elsewhere on some setups: terminal programs read it as NUL (Emacs uses it
for set-mark), macOS uses it to switch input sources when you have more than one, and so do the
Chinese IME on Windows and fcitx5 on Linux. If yours is taken, bind `ctrl-shift-space` instead
in both places, which nothing in Herdr or the OS takes by default. `"ctrl-[": "whistle.switch-mode"`
in the `terminal` section works too, as an opt-in: it takes Esc-by-Ctrl+[ from every terminal
program, and some keyboard layouts can't press it.

## Jump keys

A **jump key** takes you to a field in one press, from either mode: Alt+A goes to WHISTLE with
the agents field selected, Alt+S with the spaces field. Each is a line in `keys.json` that runs a
**verb** on a layout block, named by its id after the first colon:

```json
"global": { "alt-a": "whistle.focus:agents", "alt-s": "whistle.focus:spaces" }
```

- The verbs are `field` (select the block's field), `focus` (show the block, then select it),
  `toggle` (hide or show it) and `toggle-keep-mode`. Every jump key goes to WHISTLE, except
  `toggle-keep-mode`, which stays in the mode you pressed it in: handy to hide or show a sidebar
  while you type.
- Everything after the first colon is the block id, as written, so an id with a colon in it
  works: `whistle.field:test:stay` names block `test:stay`. The ids are the shown layout's
  (`agents` and `spaces` are Herdr's `main` layout's); a layout of your own may name its blocks
  otherwise.
- A block the shown layout doesn't have, or a hidden one for `field`, only flashes on the bar,
  and you stay where you were.
- In WHISTLE, a jump key ends a key sequence you started and runs its verb.
- Switched off, or when whistle stands aside, a jump key types into the terminal as if whistle
  weren't there.
- A jump key with an unknown verb (`whistle.fcous:agents`) is listed in settings, like any config
  problem.

On macOS, Option+letter types characters (Option+A is å), so bind `ctrl-shift-a` and
`ctrl-shift-s` instead. The full rules: [Whistle's commands](contracts/commands.md#jump-keys).

```json example Alt+A in TYPE goes to WHISTLE on the agents field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "sidebar", "type": "column", "children": [
          { "id": "spaces", "type": "block", "content": { "mod": "spaces" } },
          { "id": "agents", "type": "block", "content": { "mod": "agents" } }
        ] },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "whistle", "field": "agents" }, "state": { "mode": "whistle" } },
    { "world": { "barFocused": true }, "command": "focus:spaces", "model": { "mode": "whistle", "field": "spaces" } }
  ]
}
```

## The default map

The defaults are the same on every OS. Keys that start a group (`s`, `t`, `w`, `a`) are by
noun; their keys follow (`w` then `v`). A mapping marked **→ TYPE** makes or opens something
you type into, so it ends in TYPE with the keyboard there.

<!-- table map -->
| Keys | Does | Command |
|---|---|---|
| `/` | Go to tab or space | `mod.open:picker` |
| `p` | Command palette | `app.palette` |
| `?` | Keys | `app.help` |
| `,` | Settings | `app.settings` |
| `+` | Zoom in | `app.zoom_in` |
| `-` | Zoom out | `app.zoom_out` |
| `0` | Reset zoom | `app.zoom_reset` |
| `tab` | Next tab | `tab.next` |
| `shift-tab` | Previous tab | `tab.prev` |
| `]` | Next agent | `agent.next` |
| `[` | Previous agent | `agent.prev` |
| `b` | Sidebar | `layout.toggle:sidebar` |
| `L` | Next layout | `layout.switch` |
| `ctrl-n` | New tab → TYPE | `tab.new` |

`]` and `[` need AltGr or Option on many non-US keyboards; the `a` group does the same.

The selected terminal, searched or scrolled (Herdr's view of its history, not the program):

<!-- table map -->
| Keys | Does | Command |
|---|---|---|
| `f` | Find in the terminal → TYPE | `terminal.search` |
| `ctrl-u` | Scroll up half a page | `terminal.scroll` `{"pages": -0.5}` |
| `ctrl-d` | Scroll down half a page | `terminal.scroll` `{"pages": 0.5}` |
| `g` | Scroll to the top | `terminal.scroll` `{"to": "top"}` |
| `G` | Scroll to the bottom | `terminal.scroll` `{"to": "bottom"}` |

The groups:

<!-- table map -->
| Keys | Does | Command |
|---|---|---|
| `s` | Spaces | group |
| `s` `n` | New space → TYPE | `space.new` |
| `s` `x` | Close space | `space.close` |
| `s` `r` | Rename space | `space.rename` |
| `t` | Tabs | group |
| `t` `n` | New tab → TYPE | `tab.new` |
| `t` `x` | Close tab | `tab.close` |
| `t` `r` | Rename tab | `tab.rename` |
| `w` | Panes | group |
| `w` `v` | Split right → TYPE | `pane.split` `{"direction": "right"}` |
| `w` `s` | Split down → TYPE | `pane.split` `{"direction": "down"}` |
| `w` `q` | Close pane | `pane.close` |
| `w` `z` | Zoom pane | `pane.zoom` |
| `w` `H` | Swap left | `pane.swap` `{"direction": "left"}` |
| `w` `J` | Swap down | `pane.swap` `{"direction": "down"}` |
| `w` `K` | Swap up | `pane.swap` `{"direction": "up"}` |
| `w` `L` | Swap right | `pane.swap` `{"direction": "right"}` |
| `a` | Agents | group |
| `a` `n` | Next agent | `agent.next` |
| `a` `p` | Previous agent | `agent.prev` |

Pane and terminal commands act on the pane whistle has selected in the terminal. After a
mapping whistle keeps the keyboard, except after one that opens a dialog or a prompt (the
palette, settings, a rename), which takes it, and one that ends in TYPE.

```json example A mapping that ends in TYPE hands the keyboard to the terminal it made
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"ctrl-n\": [\"New tab\", \"tab.new\", null, \"type\"] } }",
      "user": null
    }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "ctrl-n",
      "effects": [{ "run": "tab.new", "args": {} }], "state": { "mode": "type" } },
    { "world": { "focused": { "pane": "p2" } }, "tick": 120,
      "effects": [{ "run": "pane.focus", "args": { "pane": "p2" } }], "state": { "mode": "type" } }
  ]
}
```

### Own keys

Whistle's own actions in WHISTLE. They aren't mappings and don't show in the hints. A mapping
on the same key goes over one, except inside a key sequence, where `cancel` acts first. A key
sequence has no step back: `cancel` ends it and you start again. Backspace is not an own key:
map it, or let a [field](#fields) declare it.

<!-- table keys -->
| Action | Keys | Does |
|---|---|---|
| `field-left` | `ctrl-h` | Select the field to the left |
| `field-down` | `ctrl-j` | Select the field below |
| `field-up` | `ctrl-k` | Select the field above |
| `field-right` | `ctrl-l` | Select the field to the right |
| `left` | `h` `left` | Move left in the field |
| `down` | `j` `down` | Move down in the field |
| `up` | `k` `up` | Move up in the field |
| `right` | `l` `right` | Move right in the field |
| `pick` | `enter` | Pick the item under the cursor (what that does is the field's); on the terminal, back to TYPE there |
| `type` | `i` | Back to TYPE |
| `cancel` | `escape` `ctrl-[` | End a key sequence (with none, nothing) |

#### Unbinding an own key

You can unbind any own key in your whistle.json ([Your config](#your-config)): `null` removes
the action, `[]` leaves it with no keys. You can't get trapped: the switch key always leaves
WHISTLE, even with every own key unbound.

A key freed that way is an ordinary key. A selected keynav field that declares it gets it, and
the hints list it with the field's label: with `pick` unbound, a field that declares `enter`
gets Enter. A field that doesn't declare it gets nothing, and a mapping may use the key
wherever no selected field declares it. While the key is still an own key, a field declaring
it is listed in settings as a config problem that names the own key, such as "Files (files)
declares enter, pick's own key; it counts once you unbind pick".

What else unbinding means is your choice: with `pick` unbound, Enter on the terminal no longer
goes back to TYPE (`type` still does), and Herdr's spaces, tabs and agents lists get no pick.

```json example With pick unbound, Enter is the field's that declares it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"field-right\": [\"ctrl-l\"], \"pick\": [\"enter\"], \"type\": [\"i\"] }, \"map\": {} }",
      "user": "{ \"keys\": { \"pick\": null } }"
    },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": { "enter": "Go in" } } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "ctrl-l",
      "hints": { "title": "Files", "items": [{ "key": "Enter", "label": "Go in", "group": false }] } },
    { "key": "enter", "effects": [{ "run": "files.keynav-key-enter", "args": {} }, { "focusBar": true }] },
    { "tick": 120, "problems": 0 }
  ]
}
```

## Fields

A **field** is a part of the window whistle can select in WHISTLE. `ctrl-h/j/k/l` select the
field that way, by the layout's rows and columns; entering a group of blocks picks the field
you used last there, else its terminal, else its first. Entering WHISTLE selects the terminal.

- **The terminal**: `h/j/k/l` and the arrows move between its split panes. The bar names the
  selected pane.
- **Stock fields**: Herdr's own spaces, tabs and agents blocks. Whistle drives them with
  Herdr's commands, so they have no cursor of their own: moving to an item shows it, and only
  the bar says which stock field is selected. Keys with nothing to do there do nothing.
- **The files block is not a field**: Herdr gives it no commands. A keynav copy of it would be.
- **Integration** makes them better fields: ask the agent that installed whistle to integrate
  it (RECIPE.md, Integrate). It clones Herdr's spaces, agents, tabs, files and changes as
  keynav mods (`spaces-whistle`, …) in a clone of your layout (`main-whistle`), so each gets a
  cursor that moves without picking (`enter` picks) and stays in view in a long list, a glow
  in the theme's `accent` while selected, and a few keys of its own (`n`, `r`, `x` on spaces
  and tabs); files and changes become fields too. On the spaces and agents clones, Pick
  (`enter`) lands you in TYPE in what you picked, and `space` is Show: it brings up the space
  or agent while you stay in WHISTLE and keep moving (RECIPE.md, Pick and Show). The layout's
  pane header is copied as well (`pane-whistle`) and glows on the terminal whistle has
  selected while in WHISTLE, since the bar holds the keyboard and Herdr's focus border can't
  show it. Your own layout and mods are changed in place instead. Uninstall offers to undo it.

| Block | Keys | Herdr command | Pick (`enter`) |
|---|---|---|---|
| Spaces | `j` / `k` | `space.next` / `space.prev` | stays: the space is already shown |
| Tabs | `l` / `h` | `tab.next` / `tab.prev` | stays: the tab is already shown |
| Agents | `j` / `k` | `agent.next` / `agent.prev` | goes on to the terminal, at the agent's pane (`l` too) |

Herdr's commands skip settled tabs and sub-agents without a pane, and visit rows folded away.
Whether they wrap around at the ends is up to Herdr.

```json example j on the stock spaces field shows the next space
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "spaces", "type": "block", "content": { "mod": "spaces" } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "ctrl-h", "state": { "field": "spaces" } },
    { "key": "j", "effects": [{ "run": "space.next", "args": {} }, { "focusBar": true }] }
  ]
}
```

After integration the `spaces` block holds the clone, which announces itself through keynav:
`j` moves its cursor instead of showing the next space.

```json example j on an integrated spaces clone moves its cursor
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "spaces", "type": "block", "content": { "mod": "spaces-whistle" } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:spaces-whistle {}": { "v": 3, "label": "Spaces", "keys": { "n": "New space", "r": "Rename", "x": "Close" } } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "ctrl-h", "state": { "field": "spaces" },
      "effects": [{ "setShared": "keynav", "value": { "v": 3, "active": "spaces-whistle {}" } }] },
    { "key": "j", "effects": [{ "run": "spaces-whistle.keynav-down", "args": {} }, { "focusBar": true }] },
    { "key": "enter", "effects": [{ "run": "spaces-whistle.keynav-pick", "args": {} }, { "focusBar": true }] },
    { "key": "r", "effects": [{ "run": "spaces-whistle.keynav-key-r", "args": {} }, { "focusBar": true }] }
  ]
}
```

## Key names

Whistle names keys the way Herdr's `keys.json` does: the key, with any modifiers in front,
joined by `-` (`ctrl-h`, `alt-shift-x`, `super-k`, `shift-tab`, `f2`, `space`, `shift-space`). Any spelling
Herdr accepts works, and comes down to one name:

| You write | Whistle reads | Why |
|---|---|---|
| `cmd-k`, `win-k`, `super-k` | `super-k` | Cmd on macOS, the Windows key elsewhere: one modifier |
| `secondary-k` | `super-k` on macOS, `ctrl-k` elsewhere | as in Herdr |
| `shift-ctrl-x`, `alt-ctrl-h` | `ctrl-shift-x`, `ctrl-alt-h` | modifiers in any order; whistle's is ctrl, alt, super, shift |
| `Ctrl-x`, `Enter`, `F2` | `ctrl-x`, `enter`, `f2` | modifiers and named keys in any case |
| `ctrl-X` | `ctrl-shift-x` | an uppercase letter in a chord means Shift, as in Herdr |
| `X`, `shift-x` | `X` | a key on its own is the character it types |
| `shift-space` | `shift-space` | Shift+Space is its own key, not `space`, so you can map it |

Write shifted punctuation as the character it types: `ctrl-?`, not `ctrl-shift-/`, since which
key gives `?` depends on the keyboard layout. `option` and `fn` aren't modifiers (on macOS
Option is `alt`), and a key sequence (`ctrl-a b`) isn't one key.

## Whistle edits your keys.json

Herdr runs `keys.json` before whistle sees a key, so a key another section binds (a layout's
Ctrl+H) would never reach whistle. Whistle claims the keys it needs in the `"mod:whistle"`
section, which wins while whistle has the keyboard:

```json
"mod:whistle": {
  "ctrl-space": "whistle.mode:type",
  "ctrl-h": "whistle.key-ctrl-h"
}
```

It claims every Ctrl, Alt or Super chord among its keys, and any other of its keys that the
`global` section or the shown layout's section binds. `whistle.key-<key>` is only how whistle
writes a claim; don't bind it yourself.

- Whistle owns only entries of exactly that form. Your own entries in `"mod:whistle"` stay as
  you wrote them and win: a key you bind there, in any spelling, isn't claimed.
- It writes only when its claims change, never while `keys.error` reports a problem, and never
  when you have no `keys.json` (writing one would replace Herdr's defaults).
- If Herdr rejects what it wrote, whistle puts the old text back and doesn't try that text again.
- Herdr stops adding new default shortcuts to a `keys.json` that was edited, so the first claim
  ends those upgrades.

A claimed key acts as if pressed on the bar:

```json example A claimed key in WHISTLE acts as the key pressed
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "command": "key-i",
      "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }],
      "state": { "mode": "type" } }
  ]
}
```

## Your config

Whistle's config comes in layers, each over the one before:

1. **The defaults**: `mods/whistle/mappings.json`. An update replaces it, so don't edit it.
2. **The layout's anchor**: its `mappings` and `keys` props, for keys that suit that layout's
   mods. Its other props (`mods`, `enabled`, `hints`, `nav`) and each bar's own (`bar`, its
   spot's name, and
   `hintsAlignRight`, `hintsAlignBorder` and `hintsGap`, which line the hints box up with that
   bar: `hintsAlignRight` is the px from the window's right edge to the bar block's outer edge,
   its border included) are in [The layout's whistle block](contracts/layout-block.md). A
   layout without an anchor keeps these props on its bar, which stands in for the anchor.
3. **Yours**: `whistle.json` in Herdr's home (`~/.config/herdr-app/whistle.json`). Nothing
   replaces it.

Each layer has two sections, kept apart:

```json
{
  "map": {
    "n": ["Next tab", "tab.next"],
    "1": ["Space 1", "space.select:1"],
    "w": { "name": "Panes", "map": {
      "v": ["Split right", "pane.split", { "direction": "right" }],
      "q": null
    } }
  },
  "keys": { "type": ["i", "q"], "cancel": ["escape"] }
}
```

- **`map`**, the mappings: a key to `[label, command]`, `[label, command, {args}]`, or a group
  `{ "name", "map" }` whose keys follow it (`w` then `v`); groups nest. A command is any
  `herdr-app commands` name, or a mod's `<mod>.<command>`; `name:value` fills its first
  argument, as in `keys.json`. A mapping goes over an own key.
- **`keys`**, whistle's own keys: an action to its list of keys. The actions: `field-left`,
  `field-down`, `field-up`, `field-right` (select the field that way), `left`, `down`, `up`,
  `right` (move inside it), `pick`, `type` (back to TYPE) and `cancel` (end a key sequence).
  Any other action is unknown: it is skipped and listed.
- A key set to `null` takes it away; groups merge key by key, so a layer can add to a group or
  take one key out of it. An action's list replaces the one below; `null` leaves the action
  with no keys.
- Keys are written as in [Key names](#key-names); any spelling counts.

```json example whistle.json goes over the layout, which goes over the defaults
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": {
        "mappings": { "n": ["Previous tab", "tab.prev"], "p": ["Previous tab", "tab.prev"] } } } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"n\": [\"Next tab\", \"tab.next\"] } }",
      "user": "{ \"map\": { \"n\": [\"Next space\", \"space.next\"] } }"
    }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "n",
      "effects": [{ "run": "space.next", "args": {} }, { "focusBar": true }] },
    { "key": "p", "effects": [{ "run": "tab.prev", "args": {} }, { "focusBar": true }] }
  ]
}
```

### Mods' mappings

Mods can offer whistle mappings of their own ([the contract](contracts/mod-mappings.md)). They
sit between the defaults and the layout, and count only while the mod has a block in the shown
layout. Your whistle.json and the layout can map over any of them, or set a key to `null`.

- **A mapping conflict**: two mods on one key, or a mod on one of whistle's own keys, counts
  for neither. The key keeps what the defaults give it (or the own key keeps acting), the bar
  flashes once ("g: 2 mods want it, see settings") and settings list it. Map the key yourself,
  or switch one mod off, to settle it.
- **A bad mapping a mod offers** is skipped, and settings list it under that mod's name. The
  bar flashes once when it first appears ("alpha's mappings have a problem, see settings"),
  but its marker doesn't count it: it's the mod's to fix, not your config's.
- **Switching a mod off**: a `mods` section takes a mod's mappings out whole, in whistle.json
  or the layout's anchor (whistle.json's goes over the layout's):

```json
{ "mods": { "alpha": false } }
```

  [Settings](#settings) write this for you, and can keep one mod's mapping on a conflicting
  key by writing it into your whistle.json.

### When something is wrong

Whistle works around what's wrong in its config and lists each **config problem** in its
settings, with the file and what's wrong, until it's fixed. While there are any, the bar shows
a short marker (⚠ and how many) at its end, in TYPE and WHISTLE alike.

- **A file that doesn't parse** runs on its last version that did, from this session. With
  none, whistle leaves `whistle.json` out; with no `mappings.json` at all (missing, or broken
  from the start) it runs on a few safety own keys built into it, so WHISTLE never traps the
  keyboard (`ctrl-h/j/k/l`, `h/j/k/l` and the arrows, `enter`, `i`, `escape`),
  and calls it a broken install.
- **An entry that makes no sense** (an unknown command, a key name whistle can't read, an
  unknown action, an entry of the wrong form) is skipped and listed; the rest of its file
  counts.
- **A command Herdr refuses** shows Herdr's own error message; whistle stays in its mode.
- **keys.json is never written** while one of whistle's files doesn't parse, while
  `mappings.json` is missing, or while `keys.json` itself doesn't parse or `keys.error`
  exists. Whistle looks again every second, so its claims come back by themselves once the
  file is fixed.

```json example A whistle.json that breaks runs on its last good version
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }",
      "user": "{ \"map\": { \"n\": [\"Next tab\", \"tab.next\"] } }"
    }
  },
  "steps": [
    { "tick": 120, "problems": 0 },
    { "world": { "configFiles": {
        "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }",
        "user": "{ \"map\": { \"n\": [\"Next tab\", " } }, "tick": 1000,
      "model": { "problems": [{ "source": "whistle.json", "detail": "doesn't parse; whistle runs on its last good version" }] },
      "problems": 1 },
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "n",
      "effects": [{ "run": "tab.next", "args": {} }, { "focusBar": true }] }
  ]
}
```

## Switching whistle off

`"enabled": false` in whistle.json (or in a layout's anchor; yours wins) switches WHISTLE
off: the switch key types into the terminal as if whistle weren't there, and the bar shows
"Whistle off". `whistle.off` and `whistle.on` (bind them in keys.json, or map them) write that
setting for you; `whistle.settings` opens the settings. Every command whistle answers to is in
[Whistle's commands](contracts/commands.md).

## When whistle stands aside

Sometimes whistle can't run safely, so it loads but stands aside (it is **inert**) and says why
in one Herdr notification, and in the bar instead of a mode badge. The notification comes once,
when whistle stands aside, so you learn why even with the bar hidden (in a layout with an
anchor); it comes again only if the reason changes:

- **Herdr is older than whistle needs** (`mods/whistle/mod.json` says which, under `herdr`):
  "Whistle needs Herdr ≥ …". Update Herdr.
- **Another copy of whistle runs**: two folders under `mods/` hold whistle (say an old one and
  `mods/whistle/`) and both are in the shown layout. The copy in `mods/whistle/` runs (else the
  first folder by name); the others hide their bars and say "Another whistle runs, from
  mods/whistle/". Delete the copies you don't want.

### A copy in another folder

Herdr hands a `keys.json` action to the mod its prefix names, so a copy of whistle in another
folder (say `mods/whistle-2/`, because another mod is already named `whistle`) answers only to
`whistle-2.*`: its lines read `"ctrl-space": "whistle-2.switch-mode"`, and the same for the jump
keys and the settings key. The installing agent writes them so. Switched off or standing aside,
the copy types those keys into the terminal, as the copy in `mods/whistle/` does with its own.

While no line in `global` runs this copy's switch command (`whistle-2.switch-mode`), the running
copy lists every `global` line that runs another folder's (`whistle.switch-mode`) as a
[config problem](#when-something-is-wrong) from `keys.json`, with the line to write. One line
that runs its own is enough: then it lists none. Whistle only reads `global`; it never changes
it.

```json example A copy in mods/whistle-2/ whose switch key runs whistle.switch-mode lists a config problem
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle-2" } }
    ] },
    "folder": "whistle-2",
    "copies": { "whistle-2": "1.0.0" },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keysFile": { "text": "{ \"global\": { \"ctrl-space\": \"whistle.switch-mode\" } }", "error": null, "at": 0 }
  },
  "steps": [
    { "tick": 120, "model": { "problems": [{ "source": "keys.json",
        "detail": "global › ctrl-space runs whistle.switch-mode, but this copy is whistle-2: make it whistle-2.switch-mode" }] },
      "problems": 1 }
  ]
}
```

Standing aside, whistle claims no keys, leaves keys.json alone, tells other mods only why it
stands aside (and only when no other copy runs), and the switch key types into the terminal as if whistle weren't there. Unlike
[switching it off](#switching-whistle-off), it isn't your choice: it runs again by itself once
the reason goes.

```json example On a Herdr that's too old, the switch key types through, and a notification and the bar say why
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "herdr": "0.1.0",
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.switch-mode" }]
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "typeKey": "ctrl-space", "terminal": "t1" }],
      "notified": [{ "title": "Whistle stands aside", "body": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.0). Update Herdr.", "level": "error" }],
      "published": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": null, "onTerminal": false,
        "inert": { "problem": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.0)", "fix": "Update Herdr." } } }
  ]
}
```

```json example A second copy of whistle stands aside for the one in mods/whistle/
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "old-bar", "type": "block", "content": { "mod": "whistle-old" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "folder": "whistle-old",
    "copies": { "whistle": "1.0.0", "whistle-old": "1.0.0" },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle-old.switch-mode" }]
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "typeKey": "ctrl-space", "terminal": "t1" }],
      "notified": [{ "title": "Whistle stands aside", "body": "Another whistle runs, from mods/whistle/. Delete the copies you don't want.", "level": "error" }], "published": null, "state": { "inert": { "problem": "Another whistle runs, from mods/whistle/", "fix": "Delete the copies you don't want." } } }
  ]
}
```

The notification comes once per reason, not on every tick or key, and again when the reason
changes:

```json example An inert whistle notifies once, and again when the reason changes
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle-old", "props": { "anchor": true } } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "props": { "anchor": true },
    "herdr": "0.1.0",
    "folder": "whistle-old",
    "copies": { "whistle": "1.0.0", "whistle-old": "1.0.0" }
  },
  "steps": [
    { "command": "mode:type", "notified": [{ "title": "Whistle stands aside", "body": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.0). Update Herdr.", "level": "error" }] },
    { "command": "mode:type", "notified": [] },
    { "command": "switch-mode", "notified": [] },
    { "world": { "herdr": "0.1.15" }, "command": "mode:type", "notified": [{ "title": "Whistle stands aside", "body": "Another whistle runs, from mods/whistle/. Delete the copies you don't want.", "level": "error" }] },
    { "command": "mode:type", "notified": [] }
  ]
}
```

## The bar

Whistle's bar is a thin strip the layout places (a block of the `whistle` mod). It is an aid
that shows the mode and what has the keyboard; whistle itself runs in the layout's **anchor**,
an invisible whistle block (`anchor: true`, 0 px; the layout-block contract's
[The anchor](contracts/layout-block.md#the-anchor)). Install puts both in your layout. So the
bar is optional: hide it (a jump key such as `"alt-b": "whistle.toggle-keep-mode:whistle"`, or
`herdr-app do layout.hide '{"id":"whistle"}'`) and the switch key, mappings, field keys, jump
keys and the hints box work the same; only the badge, the label and flashes go unseen until
you show it again. In a layout without an anchor, the bar stands in for it, and hiding it
switches whistle off there until it shows again.

From the left:

- **The mode badge**: `TYPE` or `WHISTLE`.
- **What has the keyboard**: `Terminal`, in WHISTLE with the selected pane's title
  (`Terminal · build`), or the selected field's name (`Spaces`). A **flash** takes its place
  until the next key: a key that isn't mapped (`w x is not mapped`), a verb that can't run, a
  mapping conflict that just appeared.
- **The marker**, at the right end while there are [config problems](#when-something-is-wrong):
  `⚠` and how many. Settings list them.

Switched off, the bar shows "Whistle off" instead of a badge, and the marker still counts.
Standing aside, it shows only [why](#when-whistle-stands-aside).

```json example Switched off, the bar says Whistle off and still counts config problems
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"enabled\": false, \"keys\": { \"jump\": [\"x\"] } }" }
  },
  "steps": [
    { "tick": 120, "state": { "enabled": false }, "problems": 1 }
  ]
}
```

A layout can offer more than one **spot** for the bar: a whistle block in each, each with its
own `bar` name, all hidden but one. You show the one you want and hide the others (Herdr
remembers it), or use the layout's own control if it has one; whistle never shows or hides a
bar. The rules:
[The layout's whistle block](contracts/layout-block.md#5-bar-names-a-spot-the-layout-shows-or-hides-it).

## Hints

When a key starts a group in WHISTLE (`w`), a box above the bar lists the keys that can follow
it: the sequence so far and the group's name on top, with the key that cancels the sequence
(`Esc cancels`), then each key and what it does. A key that starts a further group shows its
name with a `+`. The box follows the sequence into nested groups and goes away when it ends,
whether a mapping runs, the cancel key ends it or a key isn't mapped. Outside a sequence, while
a [field](#fields) that declares keys of its own is selected, the box lists those keys instead,
under the field's name. `"hints": false` in your whistle.json (or the layout's anchor; yours
wins) turns the box off. In a layout with an anchor, the box opens with every bar hidden too,
at the window's bottom right.

```json example Hints list the keys that can follow a group
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"], \"cancel\": [\"escape\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split right\", \"pane.split\"], \"m\": { \"name\": \"Move\", \"map\": {} } } } } }",
      "user": null
    }
  },
  "steps": [
    { "command": "switch-mode", "hints": null },
    { "world": { "barFocused": true }, "key": "w",
      "hints": { "keys": "w", "title": "Panes", "exit": "Esc cancels", "items": [
        { "key": "v", "label": "Split right", "group": false },
        { "key": "m", "label": "Move", "group": true }
      ] } },
    { "key": "escape", "hints": null }
  ]
}
```

## Settings

`alt-,` opens them (`whistle.settings` in keys.json's `global`, next to Herdr's own
`ctrl-,` for Herdr's settings; `ctrl-shift-,` on macOS, where Option types characters), in TYPE, in WHISTLE and while whistle is switched off; `,` in
WHISTLE opens Herdr's. Whistle's settings list:

- **Problems**: every [config problem](#when-something-is-wrong), with its file (`mappings.json`,
  `layout`, `whistle.json` or `keys.json`) and what's wrong; the bar's marker counts them.
- **Mapping conflicts**: each key two mods want, or a mod wants over one of whistle's own keys,
  with the mods (`alpha and beta both want g d`). Each has a **Keep &lt;mod&gt;'s** button
  for every mod in it, which writes that mod's mapping into your whistle.json: yours goes over
  the mods, which settles the conflict.
- **Over mods' keys**: each key the layout or you map over a mod's, labelled with who did
  (`g: you, over alpha`). These aren't problems.
- **Mods' mappings**: each mod in the shown layout that offers mappings, with a switch. Switching
  one off writes `"mods": { "<mod>": false }` into your whistle.json (on again: `true`); a
  problem in what a mod offers is listed under it, and isn't counted in the bar's marker.

A switch or a **Keep** button writes the whole whistle.json again in a standard layout (2-space
indents): your entries and their key order stay, your own line breaks don't (JSON has no
comments, so nothing else is lost). Settings never write a whistle.json that doesn't parse: fix
it first. The bar picks up what
they wrote on its next read of whistle.json, within a second, as it does for an edit by hand.

```json example Settings list a conflict and switching a mod off settles it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "beta", "type": "block", "content": { "mod": "beta" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": {
      "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } },
      "beta": { "v": 1, "map": { "g": ["Go", "beta.go"] } }
    },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }", "user": null }
  },
  "steps": [
    { "tick": 120, "settings": {
      "conflicts": [{ "keys": "g", "seq": ["g"], "mods": ["alpha", "beta"], "own": null,
        "text": "alpha and beta both want g",
        "keep": [{ "mod": "alpha", "value": ["Go", "alpha.go"] }, { "mod": "beta", "value": ["Go", "beta.go"] }] }],
      "mods": [{ "name": "alpha", "on": true, "problems": [] }, { "name": "beta", "on": true, "problems": [] }] } },
    { "world": { "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }",
        "user": "{ \"mods\": { \"alpha\": false } }" } }, "tick": 1000,
      "settings": { "conflicts": [], "mods": [{ "name": "alpha", "on": false, "problems": [] }, { "name": "beta", "on": true, "problems": [] }] } },
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "g",
      "effects": [{ "run": "beta.go", "args": {} }, { "focusBar": true }] }
  ]
}
```

## Troubleshooting

- **Ctrl+Space does nothing, or types a character**: look at the bar. "Whistle off" means
  [switched off](#switching-whistle-off); a reason instead of a badge means whistle
  [stands aside](#when-whistle-stands-aside). With a badge, the key isn't reaching Herdr: your
  OS or input method may take it (bind `ctrl-shift-space` instead, see
  [Modes and the switch key](#modes-and-the-switch-key)), or keys.json has no `global` line
  `"ctrl-space": "whistle.switch-mode"`.
- **There's no bar**: the shown layout has no whistle block. Herdr's own layouts (`main`) never
  show a new mod's bar; the agent that installed whistle makes a copy with the bar
  (`main-whistle`) and switches to it. Ask it again, or add a block of the `whistle` mod to your
  own layout.
- **A key does nothing in WHISTLE**: another `keys.json` section may bind it, and whistle
  [claims it](#whistle-edits-your-keysjson) only while keys.json parses and `keys.error` is
  absent. A mapping on a key two mods want counts for neither until you settle it in
  [settings](#settings).
- **Alt+A or Alt+S types a character** (macOS): bind `ctrl-shift-a` and `ctrl-shift-s`
  instead, see [Jump keys](#jump-keys).
- **The bar shows ⚠**: open [settings](#settings) (Alt+,) to see each problem and its file.
