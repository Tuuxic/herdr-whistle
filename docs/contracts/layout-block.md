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
| `mappings` | object | The layout's mappings, as whistle.json's `map` (see the guide's Your config). |
| `keys` | object | The layout's own keys, as whistle.json's `keys`. |
| `mods` | object | `{ "<mod>": false }` switches a mod's offered mappings off (see [Mods' mappings](mod-mappings.md)). |
| `enabled` | boolean | `false` switches WHISTLE off in this layout. Default `true`. |
| `hints` | boolean | `false` hides the hints box. Default `true`. |
| `nav` | object | `{ "<block id>": { "<direction>": "<block id>" } }`: which field the field keys reach from a block, over the layout's rows and columns. Directions: `left`, `down`, `up`, `right`. |
| `bar` | string | Names this block as a spot for the bar (see rule 5). |
| `hintsAlignRight` | number | px from the window's right edge to the bar's inside. Default 0. |
| `hintsAlignBorder` | number | The width in px of the border the layout draws around the bar. Default 0. |
| `hintsGap` | number | px between the bar's top and the hints box. Default 6. |

The three `hints*` props line the hints box up with the bar. Whistle can't measure where the
layout puts the bar, only the bar's own size, so a layout that sets the bar in from the
window's right edge, or draws a border around it, tells whistle by how much: the box is then as
wide as the bar and its border, and sits `hintsGap` above it.

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

## Stable and may change

- Stable: `mappings`, `keys`, `mods`, `enabled`, `hints`, `nav`, `bar`, `hintsAlignRight`,
  `hintsAlignBorder`, `hintsGap`, and the rules above.
- Private: `part`, which whistle sets on its own overlay copies. Don't write it.

## History

- whistle 1.0.0: first version. `nav` directions are `left`/`down`/`up`/`right` (they were
  `h`/`j`/`k`/`l`); a bad prop is now listed instead of ignored.
