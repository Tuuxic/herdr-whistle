# Whistle's commands

For anyone who binds whistle in `keys.json`, runs it from another mod, or maps its verbs: the
commands whistle answers to. A renamed copy answers under its folder's name instead of
`whistle` (verbs in mappings are always written `whistle.`).

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

### Verbs

**Verbs** act on a layout block, named by its id after a colon. A mapping (in any config layer)
or a jump key (below) can run one.

| Verb | Does |
|---|---|
| `whistle.field:<block>` | Selects the field in that block. |
| `whistle.focus:<block>` | Shows the block (switching its stack, showing what hides it) and selects it once it shows. |
| `whistle.toggle:<block>` | Hides the block if it shows (whistle moves to the terminal if its field was in it), else shows it without selecting it. |
| `whistle.toggle-keep-mode:<block>` | `toggle`, keeping the mode it was pressed in (as a jump key). A mapping runs it as `toggle`. |

In a mapping the block may also be given as args: `["Notes", "whistle.field", { "block": "notes" }]`.
A mapping with an unknown `whistle.` command, or a verb without a block, is a config problem. A
mapping that should end in TYPE says so with its fourth element, `"type"`, not with
`toggle-keep-mode`.

### Jump keys

A **jump key** is a line in Herdr's `keys.json` that runs a verb from either mode, so one key
takes you to a field:

```json
{ "global": { "alt-a": "whistle.focus:agents", "alt-s": "whistle.focus:spaces" } }
```

- Spelling: `whistle.<verb>:<block>`, with one of the four verbs above. Everything after the
  first colon is the block id, exactly as written, colons included: `whistle.field:test:stay`
  names block `test:stay` (ADR 0014).
- A jump key runs its verb and goes to WHISTLE, from TYPE or WHISTLE. Only `toggle-keep-mode`
  keeps the mode it was pressed in. There is no `field-keep-mode` or `focus-keep-mode`
  (selecting a field needs WHISTLE): they are unknown commands.
- In WHISTLE during a key sequence, a jump key ends the sequence and runs its verb. A jump key
  never goes back to TYPE: on the field already selected, it stays selected.
- A verb that can't run (no such block in the shown layout, or a hidden block for `field`)
  stays in the mode it was pressed in and flashes. In TYPE the flash ends after a short time,
  since no key reaches whistle there.
- Switched off or inert, a jump key types into the terminal, as the switch key does.
- A `keys.json` line naming an unknown verb (`whistle.fcous:agents`) is a config problem, listed
  in settings. A block the shown layout lacks is not one; pressed, it only flashes.

Whistle ships two in the `global` section: `alt-a` (agents) and `alt-s` (spaces), with ids from
Herdr's `main` layout. Beside them it ships `alt-,` → `whistle.settings` (next to Herdr's
`ctrl-,`), which opens whistle's settings from either mode and while switched off. On macOS, where Option types characters, bind `ctrl-shift-a` /
`ctrl-shift-s` / `ctrl-shift-,` instead. (Only macOS matches a shifted punctuation key by either
spelling; elsewhere Herdr names the shifted character, which depends on the keyboard layout, so
Ctrl+Shift+, would be `ctrl-<` on a US layout and `ctrl-;` on a German one: hence `alt-,`.)

### Settings commands

**Settings commands** change what whistle's settings change, without knowing whistle.json's
format: whistle writes whistle.json itself, keeping the rest of it. A client (a mod that shows
[whistle's config](config.md)) runs them with `run("whistle.mappings:alpha:off")`; keys.json
may bind them too. Since whistle 1.4.0.

| Command | Does |
|---|---|
| `whistle.mappings:<mod>:on` | Switches the mod's mappings on: `"mods": { "<mod>": true }` in whistle.json. |
| `whistle.mappings:<mod>:off` | Switches the mod's mappings off: `"mods": { "<mod>": false }`. |
| `whistle.keep-mapping:<mod>:<keys>` | Keeps the mod's mapping at that key sequence: writes it into whistle.json's `map` as the mod wrote it, so it goes over every mod's there (a conflict settled). |

- Herdr hands a mod command no args, so the target is in the name, as a verb's block is. A mod
  name is letters, digits, `.`, `_` and `-` only ([mod-mappings.md](mod-mappings.md)), so
  nothing needs escaping.
- `mappings`: the mod runs up to the last colon, then the state, `on` or `off`. Anything else
  is an unknown command.
- `keep-mapping`: the mod runs up to the first colon; the rest is the key sequence, Herdr's key
  names joined by one space (`whistle.keep-mapping:alpha:ctrl-x g`), in any spelling keys.json
  takes.
- They work whether WHISTLE is on or off, and leave the mode as it is.
- What can't be done raises an [event](events.md): whistle.json not read yet
  (`settings-unread`), whistle.json that doesn't read (`settings-broken`, and whistle leaves it
  alone), a failed write (`settings-write-failed`), and a `keep-mapping` for a mod that maps
  nothing there (`command-failed`).
- A renamed copy answers under its folder's name, as for the other commands.

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

### 6. A jump key goes to WHISTLE with its block's field selected

```json example a jump key in TYPE goes to WHISTLE on the agents field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "agents", "type": "block", "content": { "mod": "agents" } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "whistle", "field": "agents" }, "effects": [{ "focusBar": true }] }
  ]
}
```

### 7. Everything after the first colon is the block id

```json example a jump key names a block whose id holds a colon
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "test", "type": "block", "content": { "pane": {} } },
        { "id": "test:stay", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "field:test:stay", "model": { "mode": "whistle", "field": "test:stay" } }
  ]
}
```

### 8. `toggle-keep-mode` keeps the mode it was pressed in

```json example whistle.toggle-keep-mode in TYPE hides the block and stays in TYPE
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "notes", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "toggle-keep-mode:notes", "model": { "mode": "type" }, "effects": [{ "run": "layout.hide", "args": { "id": "notes" } }] }
  ]
}
```

### 9. A jump key that can't run stays in TYPE and flashes, briefly

```json example a jump key to a block the layout lacks flashes in TYPE, then the flash ends
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "type" }, "effects": [], "bar": { "badge": "TYPE", "label": "No agents in this layout" } },
    { "tick": 2500, "bar": { "label": "Terminal" } }
  ]
}
```

### 10. Switched off, a jump key types into the terminal

```json example switched off, a jump key types into the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "alt-a", "action": "whistle.focus:agents" }]
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "type" }, "effects": [{ "typeKey": "alt-a", "terminal": "t1" }] }
  ]
}
```

### 11. A jump key with an unknown verb is a config problem

```json example a keys.json jump key with an unknown verb is listed as a config problem
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keysFile": { "text": "{ \"global\": { \"alt-a\": \"whistle.fcous:agents\", \"alt-g\": \"whistle.focus:ghost\" } }", "error": null, "at": 0 }
  },
  "steps": [
    { "tick": 120, "model": { "problems": [{ "source": "keys.json", "detail": "global › alt-a: unknown whistle command whistle.fcous:agents" }] }, "bar": { "marker": "⚠ 1" } }
  ]
}
```

### 12. `whistle.mappings:<mod>:off` writes the mod off into whistle.json, keeping the rest

```json example whistle.mappings switches a mod off in whistle.json
{
  "world": {
    "focused": { "pane": "p1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{\"hints\":false}" }
  },
  "steps": [
    { "command": "mappings:alpha:off", "effects": [
      { "write": "whistle.json", "text": "{\n  \"hints\": false,\n  \"mods\": {\n    \"alpha\": false\n  }\n}\n", "expected": "{\"hints\":false}" }
    ] }
  ]
}
```

```json example whistle.mappings with a state other than on or off does nothing
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "command": "mappings:alpha:maybe", "effects": [], "unset": ["whistle.events"] }
  ]
}
```

### 13. `whistle.keep-mapping:<mod>:<keys>` writes the mod's mapping there into whistle.json

```json example whistle.keep-mapping keeps one mod's mapping in a conflict
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
      "alpha": { "v": 1, "map": { "g": { "name": "Alpha", "map": { "d": ["D", "alpha.d"] } } } },
      "beta": { "v": 1, "map": { "g": { "name": "Beta", "map": { "d": ["D", "beta.d"] } } } }
    }
  },
  "steps": [
    { "tick": 120 },
    { "command": "keep-mapping:alpha:g d", "effects": [
      { "write": "whistle.json", "text": "{\n  \"map\": {\n    \"g\": {\n      \"map\": {\n        \"d\": [\n          \"D\",\n          \"alpha.d\"\n        ]\n      }\n    }\n  }\n}\n", "expected": null }
    ] }
  ]
}
```

```json example whistle.keep-mapping for a mod that maps nothing there raises command-failed
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": { "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } } }
  },
  "steps": [
    { "tick": 120 },
    { "command": "keep-mapping:alpha:x", "effects": [], "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "command-failed", "command": "whistle.keep-mapping:alpha:x", "error": "alpha maps nothing at x", "text": "alpha maps nothing at x" }] } } }
  ]
}
```

## Stable and may change

- Stable: every command and verb above, the jump-key spelling `whistle.<verb>:<block>`
  (ADR 0014), and the settings commands' spellings.
- `whistle.key-<key>` is the form whistle writes for the keys it claims in keys.json
  (see the guide). It may change; don't bind it yourself.
- Gone in 1.0: `whistle.enter`, `whistle.focus` (without a block) and the direction commands.

## History

- whistle 1.0.0: first version of this list, with jump keys and `toggle-keep-mode`.
- whistle 1.4.0: the settings commands, `whistle.mappings:<mod>:on|off` and
  `whistle.keep-mapping:<mod>:<keys>`.
