# The layout's whistle block

For layout authors: how a layout places whistle's bar and tunes whistle for its own mods. A
layout shows whistle by having a block of the whistle mod; that block's props are this
contract.

```json
{ "id": "bar", "type": "block", "content": { "mod": "whistle", "props": {
  "mappings": { "g": ["Git", "mod.open:git"] },
  "nav": { "sidebar": { "right": "main" } },
  "hints": true
} } }
```

## Props

| Prop | Type | Meaning |
|---|---|---|
| `anchor` | boolean | `true` makes this block the anchor, the block whistle runs in (see The anchor). Size it 0 px. |
| `mappings` | object | The layout's mappings, as whistle.json's `map` (see the guide's Your config). |
| `keys` | object | The layout's own keys, as whistle.json's `keys`. |
| `mods` | object | `{ "<mod>": false }` switches a mod's offered mappings off (see [Mods' mappings](mod-mappings.md)). |
| `enabled` | boolean | `false` switches WHISTLE off in this layout. Default `true`. |
| `hints` | boolean | `false` hides the hints box. Default `true`. |
| `nav` | object | `{ "<block id>": { "<direction>": "<block id>" } }`: which field the field keys reach from a block, over the layout's rows and columns. Directions: `left`, `down`, `up`, `right`. |
| `bar` | string | Names this block as a spot for the bar (see rule 5). |
| `hintsAlignRight` | number | px from the window's right edge to the bar block's outer edge (its border included). Default 0. |
| `hintsAlignBorder` | number | The width in px of the border the layout draws around the bar. Default 0. |
| `hintsGap` | number | px between the bar's top and the hints box. Default 6. |

The three `hints*` props line the hints box up with the bar. Whistle can't measure where the
layout puts the bar, only the bar's own size inside any border, so a layout that sets the bar
in from the window's right edge, or draws a border around it, tells whistle by how much: the
box is then as wide as the bar block, border included, ends where the block ends, and sits
`hintsGap` above the block's top edge, border included (rule 7).

A layout may have several whistle blocks (bar spots). Each prop but `bar` comes from the first
block, in layout order, that has it, so a second spot needn't repeat the mappings.

whistle.json's own `enabled`, `hints` and `bar` go over the layout's: the person has the last
word.

## Rules

The examples below run as tests: each is a scenario through whistle's core.

### 1. `enabled: false` switches WHISTLE off: the switch key goes to the terminal

The key Herdr binds to `whistle.whistle` types into the focused terminal as if whistle weren't
there, and the bar shows no mode badge. Switched off in WHISTLE, whistle goes back to TYPE.

```json example enabled false sends the switch key to the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.whistle" }]
  },
  "steps": [
    { "command": "whistle", "effects": [{ "typeKey": "ctrl-space", "terminal": "t1" }],
      "bar": { "badge": null, "label": "Whistle off" } }
  ]
}
```

### 2. whistle.json's `enabled` goes over the layout's

```json example whistle.json switches whistle back on in a layout that has it off
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"enabled\": true }" }
  },
  "steps": [{ "command": "whistle", "effects": [{ "focusBar": true }], "bar": { "badge": "WHISTLE" } }]
}
```

### 3. `nav` overrides the field a direction reaches

An entry counts for its block and for every field inside it (a group's id covers its fields),
the nearest first. Directions it leaves out follow the layout. A block it names that shows no
field is no move.

```json example A nav override sends ctrl-j from a to b
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "a", "type": "block", "content": { "pane": {} } },
        { "id": "b", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "c", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "nav": { "a": { "down": "b" } } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "model": { "recent": ["a"] },
  "steps": [
    { "command": "whistle", "model": { "field": "a" } },
    { "key": "ctrl-j", "model": { "field": "b" } },
    { "key": "ctrl-j", "model": { "field": "c" } }
  ]
}
```

### 4. A bad prop is skipped and listed

A prop of the wrong type, a `nav` entry with an unknown direction or block, or a prop whistle
doesn't know is skipped and listed as a config problem (source `layout`) in whistle's settings,
with a marker on the bar. The rest of the block still counts.

```json example A bad enabled prop is skipped and listed
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "enabled": "no" } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "whistle", "effects": [{ "focusBar": true }],
      "model": { "problems": [{ "source": "layout", "detail": "enabled should be true or false" }] },
      "bar": { "badge": "WHISTLE", "marker": "⚠ 1" } }
  ]
}
```

### 5. `bar` names a spot; whistle.json's `bar` picks it

A layout that offers several spots names each whistle block with `bar` and hides all but one.
When whistle.json's `bar` names a spot, whistle shows that spot and hides the others. A name
the layout doesn't have is a config problem (source `whistle.json`) and the bar stays where it
is.

```json example whistle.json's bar moves the bar to the Top spot
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top-bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Top" } } },
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bottom-bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } }
    ] },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"bar\": \"Top\" }" }
  },
  "steps": [
    { "tick": 120, "effects": [
      { "run": "layout.show", "args": { "id": "top-bar" } },
      { "run": "layout.hide", "args": { "id": "bottom-bar" } }
    ] }
  ]
}
```

### 6. Without an anchor, a hidden spot's copy rests

Each whistle block is a copy of whistle, told apart by its props (give each spot its own
`bar` name). In a layout without an anchor, while a copy's block is hidden, that copy rests: it stays in TYPE, claims no keys,
publishes nothing and moves no spot, so only the shown spot's copy runs. Shown again, it runs
again and publishes its state anew. The blocks a copy hid itself, while it stood aside for
another copy of whistle, don't make it rest: once that copy's blocks go, it shows them again.

```json example Without an anchor, a hidden spot's copy rests while the shown one runs
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top-bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Top" } } },
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bottom-bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } }
    ] },
    "props": { "bar": "Top" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"bar\": \"Top\" }" }
  },
  "steps": [
    { "tick": 120, "effects": [], "published": null }
  ]
}
```

### 7. The hints box lines up with the bar block, border included

A bar block that ends 200 px from the window's right edge, with a 2 px border, sets
`hintsAlignRight: 200` and `hintsAlignBorder: 2`: the box is as wide as the bar and both
borders, ends where the block's outer edge does, and sits `hintsGap` (6) above the block's top
border.

```json example A bar 200 px in with a 2 px border gets a hints box as wide as it, 6 px above it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": {
        "hintsAlignRight": 200, "hintsAlignBorder": 2,
        "mappings": { "w": { "name": "Panes", "map": { "v": ["Split right", "pane.split", { "direction": "right" }] } } }
      } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "viewport": { "width": 1000, "height": 600 },
    "barSize": { "width": 600, "height": 22 }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "w", "hintsWindow": [{ "openOverlay": "hints", "spec": {
      "mod": "whistle", "kind": "window", "frame": "none", "width": 604, "height": 50,
      "at": { "x": 196, "y": 518 }, "props": { "part": "hints", "width": 604 } } }] }
  ]
}
```

The box is 600 + 2 × 2 = 604 px wide and starts at 1000 − 200 − 604 = 196; the bar block is
22 + 2 × 2 = 26 px high, so the box (50 px, one row) ends 6 px above it: 600 − 26 − 6 − 50 = 518.

## The anchor

The anchor is a whistle block with the prop `anchor: true`, sized 0 px, that draws nothing
(ADR 0018). Whistle runs in it: it holds the keyboard in WHISTLE, takes whistle's commands,
jump keys and claimed keys, publishes the whistle state, and shows the picked bar spot. Bars
are then only views: hiding or showing one changes what you see, never what whistle does.
Herdr doesn't run a hidden block's copy, so never hide the anchor.

```json
{ "id": "whistle-anchor", "type": "block", "size": { "px": 0 }, "content": { "mod": "whistle", "props": { "anchor": true } } }
```

A layout without an anchor works as before: a bar stands in for it, and a hidden bar's copy
rests (rule 6).

### 8. With every bar hidden, whistle runs in the anchor

The switch key enters WHISTLE and whistle takes the keyboard (through the anchor), mappings
run, and the field keys select fields. The whistle state is published as with a bar.

```json example Anchored with every bar hidden, the switch key enters WHISTLE
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "anchor": true },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "whistle", "effects": [{ "focusBar": true }], "model": { "mode": "whistle", "problems": [] },
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true } }
  ]
}
```

A mapping runs and the field keys select fields with no bar shown:

```json example Anchored with every bar hidden, a mapping runs and ctrl-h selects a field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "side", "type": "block", "content": { "pane": {} } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "anchor": true },
    "focused": { "pane": "p1", "terminal": "t1" },
    "configFiles": { "defaults": "{ \"keys\": { \"field-left\": [\"ctrl-h\"], \"type\": [\"i\"] }, \"map\": { \"z\": [\"Zoom\", \"pane.zoom\"] } }", "user": null }
  },
  "model": { "recent": ["main"] },
  "steps": [
    { "command": "whistle", "effects": [{ "focusBar": true }], "model": { "field": "main" } },
    { "world": { "barFocused": true }, "command": "key-ctrl-h", "model": { "field": "side" }, "handled": true },
    { "key": "z", "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }, { "run": "pane.zoom", "args": {} }, { "focusBar": true }], "model": { "mode": "whistle" } },
    { "key": "i", "model": { "mode": "type" } }
  ]
}
```

The anchor is no field: the field keys pass it by.

```json example The anchor is never a field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "anchor": true },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "whistle", "model": { "field": "main" } },
    { "world": { "barFocused": true }, "key": "ctrl-j", "model": { "field": "main" } },
    { "key": "ctrl-k", "model": { "field": "main" } }
  ]
}
```

### 9. In a layout with an anchor, a bar's copy only draws

Herdr hands every whistle command and claimed key to every shown copy of whistle, so a bar's
copy in a layout with an anchor acts on none of them, nor on its ticks: it draws the bar the
anchor sets, so a key press is never handled twice.

```json example A bar's copy in an anchored layout returns no effects for a command or a key
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "bar": "Bottom" },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.whistle" }]
  },
  "steps": [
    { "tick": 120, "effects": [], "published": null, "hintsWindow": [] },
    { "command": "whistle", "effects": [], "published": null, "handled": false, "model": { "mode": "type" } },
    { "command": "key-ctrl-h", "effects": [], "published": null, "handled": false },
    { "command": "focus:main", "effects": [], "published": null, "handled": false },
    { "world": { "barFocused": true }, "key": "i", "effects": [], "published": null, "handled": false }
  ]
}
```

### 10. Hiding or showing a bar changes only what you see

Hiding the bar in WHISTLE keeps the mode, the selected field and the key sequence. The anchor
sets the bar's model whether or not a bar shows, so a bar shown later draws the current state
straight away.

```json example Hiding the bar in WHISTLE keeps the mode, the field and the key sequence
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "anchor": true },
    "focused": { "pane": "p1", "terminal": "t1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split\", \"pane.split\"] } } } }", "user": null }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "w", "model": { "sequence": ["w"] } },
    { "world": { "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
        { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
      ] } },
      "tick": 120, "effects": [], "model": { "mode": "whistle", "field": "main", "sequence": ["w"] } },
    { "key": "v", "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }, { "run": "pane.split", "args": {} }, { "focusBar": true }] }
  ]
}
```

```json example A bar shown later draws the state the anchor set while it was hidden
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "anchor": true },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "whistle", "shared": { "whistle.bar:whistle": { "badge": "WHISTLE", "label": "Terminal", "marker": null } } },
    { "world": { "barFocused": true, "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
        { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
      ] } },
      "tick": 120, "effects": [], "model": { "mode": "whistle" }, "bar": { "badge": "WHISTLE", "label": "Terminal" } }
  ]
}
```

### 11. whistle.json's `bar` still picks the spot, from the anchor

```json example Anchored, whistle.json's bar moves the bar to the Top spot
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top-bar", "type": "block", "hidden": true, "content": { "mod": "whistle", "props": { "bar": "Top" } } },
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bottom-bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } }
    ] },
    "props": { "anchor": true },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"bar\": \"Top\" }" }
  },
  "steps": [
    { "tick": 120, "effects": [
      { "run": "layout.show", "args": { "id": "top-bar" } },
      { "run": "layout.hide", "args": { "id": "bottom-bar" } }
    ] }
  ]
}
```

### 12. One anchor drives; a second stands aside

A layout has one anchor. If it has more, the first in layout order runs whistle and every
other anchor stands aside like a bar's copy: it acts on no command, key or tick. Each extra
anchor is a config problem in settings, so the mistake shows but costs nothing. Copies are
told apart only by their props, so an extra anchor with exactly the first one's props can't
tell it isn't the first: remove it.

```json example A second anchor stands aside and is listed as a config problem
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } },
      { "id": "spare-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true, "hints": true } } }
    ] },
    "props": { "anchor": true, "hints": true },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.whistle" }]
  },
  "steps": [
    { "tick": 120, "effects": [], "published": null, "hintsWindow": [] },
    { "command": "whistle", "effects": [], "published": null, "handled": false, "model": { "mode": "type" } },
    { "world": { "barFocused": true }, "key": "i", "effects": [], "published": null, "handled": false }
  ]
}
```

```json example The first anchor runs whistle and lists the second as a config problem
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "bar": "Bottom" } } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true } } },
      { "id": "spare-anchor", "type": "block", "content": { "mod": "whistle", "props": { "anchor": true, "hints": true } } }
    ] },
    "props": { "anchor": true },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "whistle", "effects": [{ "focusBar": true }], "model": { "mode": "whistle", "problems": [
      { "source": "layout", "detail": "anchor: spare-anchor is a second anchor and stands aside; whistle-anchor runs whistle" }
    ] } }
  ]
}
```

## Stable and may change

- Stable: `anchor`, `mappings`, `keys`, `mods`, `enabled`, `hints`, `nav`, `bar`, `hintsAlignRight`,
  `hintsAlignBorder`, `hintsGap`, and the rules above.
- Private: `part`, which whistle sets on its own overlay copies. Don't write it.

## History

- whistle 1.0.0: first version. `nav` directions are `left`/`down`/`up`/`right` (they were
  `h`/`j`/`k`/`l`); a bad prop is now listed instead of ignored. `hintsAlignRight` measures to
  the bar block's outer edge, border included (it was to the bar's inside), and `hintsGap`
  counts from the block's top border.
