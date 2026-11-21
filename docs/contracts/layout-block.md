# The layout's whistle block

For layout authors: how a layout runs whistle and tunes it for its own mods. Whistle runs in
its block, the anchor: a block of the whistle mod, sized 0 px, that draws nothing. Its props are
this contract. What shows whistle (a bar, the hints box, a settings dialog) is a client's, such
as [whistle-ui](whistle-ui.md), with blocks and props of its own.

```json
{ "id": "whistle-anchor", "type": "block", "size": { "px": 0 }, "content": { "mod": "whistle", "props": {
  "mappings": { "g": ["Git", "mod.open:git"] },
  "nav": { "sidebar": { "right": "main" } }
} } }
```

## Props

| Prop | Type | Meaning |
|---|---|---|
| `mappings` | object | The layout's mappings, as whistle.json's `map` (see the guide's Your config). |
| `keys` | object | The layout's own keys, as whistle.json's `keys`. |
| `mods` | object | `{ "<mod>": false }` switches a mod's offered mappings off (see [Mods' mappings](mod-mappings.md)). |
| `enabled` | boolean | `false` switches WHISTLE off in this layout. Default `true`. |
| `nav` | object | `{ "<block id>": { "<direction>": "<block id>" } }`: which field the field keys reach from a block, over the layout's rows and columns. Directions: `left`, `down`, `up`, `right`. |

They are the layout's config layer. whistle.json's own `enabled` goes over the layout's: the
person has the last word.

## Rules

The examples below run as tests: each is a scenario through whistle's core.

### 1. `enabled: false` switches WHISTLE off: the switch key goes to the terminal

The key Herdr binds to `whistle.switch-mode` types into the focused terminal as if whistle weren't
there, and the whistle state says `enabled: false`. Switched off in WHISTLE, whistle goes back to
TYPE.

```json example enabled false sends the switch key to the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.switch-mode" }]
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "typeKey": "ctrl-space", "terminal": "t1" }],
      "state": { "enabled": false } }
  ]
}
```

### 2. whistle.json's `enabled` goes over the layout's

```json example whistle.json switches whistle back on in a layout that has it off
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"enabled\": true }" }
  },
  "steps": [{ "command": "switch-mode", "effects": [{ "focusAnchor": true }], "state": { "mode": "whistle" } }]
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
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "nav": { "a": { "down": "b" } } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "model": { "recent": ["a"] },
  "steps": [
    { "command": "switch-mode", "model": { "field": "a" } },
    { "key": "ctrl-j", "model": { "field": "b" } },
    { "key": "ctrl-j", "model": { "field": "c" } }
  ]
}
```

### 4. A bad prop is skipped and listed

A prop of the wrong type, a `nav` entry with an unknown direction or block, or a prop whistle
doesn't know is skipped and listed as a config problem (source `layout`) in
[whistle.config](config.md). The rest of the block still counts. A client's props, such as
whistle-ui's `hints`, go on the client's own blocks.

```json example A bad enabled prop and an unknown prop are skipped and listed
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle", "props": { "enabled": "no", "hints": false } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "focusAnchor": true }],
      "model": { "problems": [
        { "source": "layout", "detail": "enabled should be true or false" },
        { "source": "layout", "detail": "hints: not a whistle block prop" }
      ] },
      "state": { "mode": "whistle" }, "problems": 2 }
  ]
}
```

### 5. Whistle runs in its block, the anchor, which draws nothing

Every whistle block is the anchor (ADR 0005). Whistle runs in it: it holds the
keyboard in WHISTLE, takes whistle's commands, jump keys and claimed keys, and publishes the
whistle state and its other public keys. It draws nothing, so size it 0 px. Whatever shows
whistle is a client's, so hiding or showing a client's bar changes what you see, never what
whistle does. Herdr doesn't run a hidden block's copy, so never hide the anchor.

```json example The switch key enters WHISTLE through the anchor, with no bar in the layout
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "props": {},
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "focusAnchor": true }], "model": { "mode": "whistle", "problems": [] },
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } }
  ]
}
```

A mapping runs and the field keys select fields:

```json example Through the anchor, a mapping runs and ctrl-h selects a field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "side", "type": "block", "content": { "pane": {} } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "props": {},
    "focused": { "pane": "p1", "terminal": "t1" },
    "configFiles": { "defaults": "{ \"keys\": { \"field-left\": [\"ctrl-h\"], \"type\": [\"i\"] }, \"map\": { \"z\": [\"Zoom\", \"pane.zoom\"] } }", "user": null }
  },
  "model": { "recent": ["main"] },
  "steps": [
    { "command": "switch-mode", "effects": [{ "focusAnchor": true }], "model": { "field": "main" } },
    { "world": { "anchorFocused": true }, "command": "key-ctrl-h", "model": { "field": "side" }, "handled": true },
    { "key": "z", "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }, { "run": "pane.zoom", "args": {} }, { "focusAnchor": true }], "model": { "mode": "whistle" } },
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
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "props": {},
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "switch-mode", "model": { "field": "main" } },
    { "world": { "anchorFocused": true }, "key": "ctrl-j", "model": { "field": "main" } },
    { "key": "ctrl-k", "model": { "field": "main" } }
  ]
}
```

### 6. The first whistle block runs whistle; any other is left out and listed

A layout has one whistle block. If it has more, the first in layout order runs whistle and every
other is left out: Herdr hands every command and claimed key to every copy, so an extra block's
copy acts on none of them, nor on its ticks, and a key press is never handled twice. Its props
count for nothing. Each extra block is a config problem, so the mistake shows but costs nothing.

```json example The first whistle block runs whistle and lists the second as a config problem
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } },
      { "id": "spare", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "props": {},
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "focusAnchor": true }], "model": { "mode": "whistle", "problems": [
      { "source": "layout", "detail": "spare: a second whistle block, left out; whistle-anchor runs whistle" }
    ] } }
  ]
}
```

```json example A second whistle block's copy acts on nothing
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } },
      { "id": "spare", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "props": { "enabled": false },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.switch-mode" }]
  },
  "steps": [
    { "tick": 120, "effects": [], "published": null, "unset": ["whistle.hints", "whistle.events", "whistle.config"] },
    { "command": "switch-mode", "effects": [], "published": null, "handled": false, "model": { "mode": "type" } },
    { "command": "key-ctrl-h", "effects": [], "published": null, "handled": false },
    { "world": { "anchorFocused": true }, "key": "i", "effects": [], "published": null, "handled": false }
  ]
}
```

### 7. Whistle blocks with the same props make whistle inert

Copies are told apart only by their props, so whistle blocks with the same props can't tell
which of them comes first. Whistle is then inert: no copy runs, the switch key types through,
and one Herdr notification and the whistle state's `inert` say to keep one.

```json example Whistle blocks with the same props make whistle inert, saying to keep one
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } },
      { "id": "twin", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "props": {},
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "ctrl-space", "action": "whistle.switch-mode" }]
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "typeKey": "ctrl-space", "terminal": "t1" }], "model": { "mode": "type" },
      "notified": [{ "title": "Whistle stands aside",
        "body": "Whistle blocks whistle-anchor and twin have the same props, so whistle can't tell which one runs. Keep one.", "level": "error" }],
      "state": { "inert": { "problem": "Whistle blocks whistle-anchor and twin have the same props, so whistle can't tell which one runs", "fix": "Keep one." } } },
    { "command": "switch-mode", "notified": [] }
  ]
}
```

### 8. With no whistle block, whistle doesn't run

A layout without a whistle block runs no whistle: a copy that finds none in the shown layout
acts on nothing and publishes nothing.

```json example In a layout with no whistle block, whistle acts on nothing
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } }
    ] },
    "props": {},
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "tick": 120, "effects": [], "published": null },
    { "command": "switch-mode", "effects": [], "published": null, "handled": false, "model": { "mode": "type" } }
  ]
}
```

## Stable and may change

- Stable: `mappings`, `keys`, `mods`, `enabled`, `nav`, and the rules above.
