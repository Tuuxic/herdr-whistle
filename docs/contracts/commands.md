# Whistle's commands

For anyone who binds whistle in `keys.json`, runs it from another mod, or maps its verbs: the
commands whistle answers to. A renamed copy answers under its folder's name instead of
`whistle` (in-map verbs are always written `whistle.`).

## Commands

| Command | Does |
|---|---|
| `whistle.whistle` | Switches: TYPE to WHISTLE, WHISTLE to TYPE. Switched off, the key bound to it types into the terminal. |
| `whistle.type` | Back to TYPE (nothing in TYPE). |
| `whistle.on` | Switches WHISTLE on: writes `"enabled": true` into whistle.json. |
| `whistle.off` | Switches WHISTLE off: back to TYPE, and writes `"enabled": false` into whistle.json. |
| `whistle.settings` | Opens whistle's settings (from WHISTLE, back to TYPE first). |

`on`, `off` and `settings` work whether WHISTLE is on or off. `on` and `off` keep the rest of
whistle.json; with a whistle.json that doesn't parse they only flash, and leave it alone.

### In-map verbs

Mappings can also run these, in any config layer. They act on a layout block by its id.

| Verb | Does |
|---|---|
| `whistle.field:<block>` | Selects the field in that block. |
| `whistle.focus:<block>` | Shows the block (switching its stack, showing what hides it) and selects it once it shows. |
| `whistle.toggle:<block>` | Hides the block if it shows (whistle moves to the terminal if its field was in it), else shows it without selecting it. |

The block may also be given as args: `["Notes", "whistle.field", { "block": "notes" }]`. A
mapping with an unknown `whistle.` command, or a verb without a block, is a config problem.

## Rules

The examples below run as tests: each is a scenario through whistle's core.

### 1. `whistle.off` writes whistle.json, keeping the rest

```json example whistle.off writes enabled false into whistle.json
{
  "world": {
    "focused": { "pane": "p1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{\"hints\":false}" }
  },
  "steps": [
    { "command": "off", "effects": [
      { "write": "whistle.json", "text": "{\n  \"hints\": false,\n  \"enabled\": false\n}\n", "expected": "{\"hints\":false}" }
    ] }
  ]
}
```

### 2. `whistle.settings` opens the settings, leaving WHISTLE first

```json example whistle.settings in WHISTLE goes back to TYPE and opens the settings
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "command": "settings", "model": { "mode": "type" }, "effects": [
      { "run": "pane.focus", "args": { "pane": "p1" } },
      { "openOverlay": "settings", "spec": { "mod": "whistle", "kind": "dialog", "width": 640, "height": 0.8, "props": { "part": "settings" } } }
    ] }
  ]
}
```

### 3. `whistle.field:<block>` selects; a block that doesn't show only flashes

```json example whistle.field selects the field in a block
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "notes", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "log", "type": "block", "hidden": true, "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "mappings": {
        "n": ["Notes", "whistle.field:notes"], "l": ["Log", "whistle.field:log"] } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "whistle", "model": { "field": "main" } },
    { "world": { "barFocused": true }, "key": "n", "model": { "field": "notes" }, "effects": [] },
    { "key": "l", "model": { "field": "notes" }, "bar": { "label": "log can't be selected now" } }
  ]
}
```

### 4. `whistle.focus:<block>` shows a block and selects it once it shows

```json example whistle.focus shows a hidden block, then selects it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "log", "type": "block", "hidden": true, "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "mappings": { "g": ["Log", "whistle.focus:log"] } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "g",
      "effects": [{ "run": "layout.show", "args": { "id": "log" } }, { "focusBar": true }], "model": { "field": "main" } },
    { "world": { "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "log", "type": "block", "content": { "pane": {} } },
        { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "mappings": { "g": ["Log", "whistle.focus:log"] } } } }
      ] } }, "tick": 120, "model": { "field": "log" } }
  ]
}
```

### 5. `whistle.toggle:<block>` hides a block that shows, and shows one that doesn't

```json example whistle.toggle hides the selected block and moves to the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "notes", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "mappings": {
        "n": ["Notes", "whistle.field:notes"], "b": ["Notes", "whistle.toggle:notes"] } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "n", "model": { "field": "notes" } },
    { "key": "b", "effects": [{ "run": "layout.hide", "args": { "id": "notes" } }, { "focusBar": true }],
      "model": { "field": "main" } }
  ]
}
```

## Stable and may change

- Stable: every command and verb above.
- `whistle.key-<key>` is the form whistle writes for the keys it claims in keys.json
  (see the guide). It may change; don't bind it yourself.
- Gone in 1.0: `whistle.enter`, `whistle.focus` (without a block) and the direction commands.

## History

- whistle 1.0.0: first version of this list.
