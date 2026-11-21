# Whistle's commands

For anyone who binds whistle in `keys.json`, runs it from another mod, or maps its verbs: the
commands whistle answers to. A renamed copy answers under its folder's name instead of
`whistle` (verbs in mappings are always written `whistle.`).

## Spelling

Every command is `whistle.<command>` or `whistle.<command>:<argument>`: at most one argument,
everything after the first colon, as Herdr's own `name:value` commands are. Herdr hands a mod's
command over as that one string and never passes args, so each command declares what its
argument is:

- **none**: `whistle.switch-mode`;
- **plain**: the string as it is, never parsed (a block id, a mod name, a word such as `type`);
- **JSON**: one JSON value, only where a command needs several values
  (`whistle.keep-mapping:{"mod":"claude-hints","keys":["g","q"]}`).

A command whistle doesn't know is a config problem on a keys.json line, and a `command-failed`
[event](events.md) when it runs. So is a known one with the wrong argument: a word it doesn't
take (`whistle.mode:foo`), JSON that doesn't parse, or JSON missing a field.

**JSON from Windows PowerShell 5.1.** PowerShell 5.1 strips the double quotes inside an argument
it passes to a program, so `herdr-app do 'whistle.keep-mapping:{"mod":"a","keys":["g"]}'` reaches
Herdr broken. Stop PowerShell parsing the line with `--%`:

```powershell
herdr-app do --% "whistle.keep-mapping:{\"mod\":\"a\",\"keys\":[\"g\"]}"
```

(Tested with node on PowerShell 5.1.26100; for `herdr-app` it's inferred, as the stripping is
PowerShell's.) Bash, zsh and PowerShell 7.3 and later pass the quotes through.

## Commands

| Command | Argument | Does |
|---|---|---|
| `whistle.switch-mode` | none | Switches: TYPE to WHISTLE, WHISTLE to TYPE. Switched off, the key bound to it types into the terminal. |
| `whistle.mode:type` | `type` | Back to TYPE (nothing in TYPE). |
| `whistle.mode:whistle` | `whistle` | To WHISTLE (nothing in WHISTLE). Switched off, the key bound to it types into the terminal, as for `switch-mode`. |
| `whistle.on` | none | Switches WHISTLE on: writes `"enabled": true` into whistle.json. |
| `whistle.off` | none | Switches WHISTLE off: back to TYPE, and writes `"enabled": false` into whistle.json. |

`on` and `off` work whether WHISTLE is on or off. They keep the rest of whistle.json; with a
whistle.json that doesn't parse they only raise a `settings-broken` [event](events.md), and
leave it alone. Whistle opens no dialog: a client such as whistle-ui shows its settings
([whistle-ui.md](whistle-ui.md)).

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
  names block `test:stay` (ADR 0007).
- A jump key runs its verb and goes to WHISTLE, from TYPE or WHISTLE. Only `toggle-keep-mode`
  keeps the mode it was pressed in. There is no `field-keep-mode` or `focus-keep-mode`
  (selecting a field needs WHISTLE): they are unknown commands.
- In WHISTLE during a key sequence, a jump key ends the sequence and runs its verb. A jump key
  never goes back to TYPE: on the field already selected, it stays selected.
- A verb that can't run (no such block in the shown layout, or a hidden block for `field`)
  stays in the mode it was pressed in and raises an [event](events.md) (`verb-failed` or
  `cant-select`).
- Switched off or inert, a jump key types into the terminal, as the switch key does.
- A `keys.json` line naming an unknown verb (`whistle.fcous:agents`) is a config problem, listed
  in [whistle.config](config.md). A block the shown layout lacks is not one; pressed, it only
  raises an event.

Whistle ships two in the `global` section: `alt-a` (agents) and `alt-s` (spaces), with ids from
Herdr's `main` layout. On macOS, where Option types characters, bind `ctrl-shift-a` /
`ctrl-shift-s` instead.

### Settings commands

**Settings commands** change whistle's settings without knowing whistle.json's
format: whistle writes whistle.json itself, keeping the rest of it. A client (a mod that shows
[whistle's config](config.md)) runs them with `run("whistle.mappings-off:alpha")`; keys.json
may bind them too.

| Command | Argument | Does |
|---|---|---|
| `whistle.mappings-on:<mod>` | plain: the mod's name | Switches the mod's mappings on: `"mods": { "<mod>": true }` in whistle.json. |
| `whistle.mappings-off:<mod>` | plain: the mod's name | Switches the mod's mappings off: `"mods": { "<mod>": false }`. |
| `whistle.keep-mapping:{"mod":"<mod>","keys":[…]}` | JSON: `mod` the mod's name, `keys` the key sequence as Herdr's key names (`["ctrl-x", "g"]`, any spelling keys.json takes) | Keeps the mod's mapping at that key sequence: writes it into whistle.json's `map` as the mod wrote it, so it goes over every mod's there (a conflict settled). |

- The mod name is plain, everything after the first colon, so it may hold any character.
- They work whether WHISTLE is on or off, and leave the mode as it is.
- What can't be done raises an [event](events.md): whistle.json not read yet
  (`settings-unread`), whistle.json that doesn't read (`settings-broken`, and whistle leaves it
  alone), a failed write (`settings-write-failed`), and a `keep-mapping` for a mod that maps
  nothing there (`command-failed`).
- A renamed copy answers under its folder's name, as for the other commands.

### Event subscriptions

A mod subscribes to get [events](events.md#subscriptions) pushed to it as
`<mod>.whistle-event:<event>` commands, only while it has a block that shows.

| Command | Argument | Does |
|---|---|---|
| `whistle.subscribe:{"mod":"<mod>","groups":[…],"kinds":[…]}` | JSON: `mod` the mod's name, `groups` and `kinds` optional lists of strings | Sets the mod's whole filter, replacing any earlier one; with neither `groups` nor `kinds`, every event. Sending it again is harmless. |
| `whistle.unsubscribe:<mod>` | plain: the mod's name | Removes the mod's filter (nothing if it has none). |

- Subscriptions are per mod, not per copy, and outlive layout changes.
- They work whether WHISTLE is on or off, and leave the mode as it is.
- A bad argument (no `mod`, `groups` or `kinds` that aren't lists of strings) raises
  `command-failed`.

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

### 2. `whistle.field:<block>` selects; a block that doesn't show only raises an event

```json example whistle.field selects the field in a block
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "notes", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "log", "type": "block", "hidden": true, "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle", "props": { "mappings": {
        "n": ["Notes", "whistle.field:notes"], "l": ["Log", "whistle.field:log"] } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode", "model": { "field": "main" } },
    { "world": { "anchorFocused": true }, "key": "n", "model": { "field": "notes" }, "effects": [] },
    { "key": "l", "model": { "field": "notes" }, "raised": [{ "text": "log can't be selected now" }] }
  ]
}
```

### 3. `whistle.focus:<block>` shows a block and selects it once it shows

```json example whistle.focus shows a hidden block, then selects it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "log", "type": "block", "hidden": true, "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle", "props": { "mappings": { "g": ["Log", "whistle.focus:log"] } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "g",
      "effects": [{ "run": "layout.show", "args": { "id": "log" } }, { "focusAnchor": true }], "model": { "field": "main" } },
    { "world": { "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "log", "type": "block", "content": { "pane": {} } },
        { "id": "anchor", "type": "block", "content": { "mod": "whistle", "props": { "mappings": { "g": ["Log", "whistle.focus:log"] } } } }
      ] } }, "tick": 120, "model": { "field": "log" } }
  ]
}
```

### 4. `whistle.toggle:<block>` hides a block that shows, and shows one that doesn't

```json example whistle.toggle hides the selected block and moves to the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "notes", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle", "props": { "mappings": {
        "n": ["Notes", "whistle.field:notes"], "b": ["Notes", "whistle.toggle:notes"] } } } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "n", "model": { "field": "notes" } },
    { "key": "b", "effects": [{ "run": "layout.hide", "args": { "id": "notes" } }, { "focusAnchor": true }],
      "model": { "field": "main" } }
  ]
}
```

### 5. A jump key goes to WHISTLE with its block's field selected

```json example a jump key in TYPE goes to WHISTLE on the agents field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "agents", "type": "block", "content": { "mod": "agents" } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "whistle", "field": "agents" }, "effects": [{ "focusAnchor": true }] }
  ]
}
```

### 6. Everything after the first colon is the block id

```json example a jump key names a block whose id holds a colon
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "test", "type": "block", "content": { "pane": {} } },
        { "id": "test:stay", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "field:test:stay", "model": { "mode": "whistle", "field": "test:stay" } }
  ]
}
```

### 7. `toggle-keep-mode` keeps the mode it was pressed in

```json example whistle.toggle-keep-mode in TYPE hides the block and stays in TYPE
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "notes", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "toggle-keep-mode:notes", "model": { "mode": "type" }, "effects": [{ "run": "layout.hide", "args": { "id": "notes" } }] }
  ]
}
```

### 8. A jump key that can't run stays in TYPE and raises an event

```json example a jump key to a block the layout lacks raises verb-failed in TYPE
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" }
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "type" }, "effects": [], "state": { "mode": "type" },
      "raised": [{ "kind": "verb-failed", "block": "agents", "reason": "missing", "text": "No agents in this layout" }] }
  ]
}
```

### 9. Switched off, a jump key types into the terminal

```json example switched off, a jump key types into the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keys": [{ "section": "global", "keys": "alt-a", "action": "whistle.focus:agents" }]
  },
  "steps": [
    { "command": "focus:agents", "model": { "mode": "type" }, "effects": [{ "typeKey": "alt-a", "terminal": "t1" }] }
  ]
}
```

### 10. A jump key with an unknown verb is a config problem

```json example a keys.json jump key with an unknown verb is listed as a config problem
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1", "terminal": "t1" },
    "keysFile": { "text": "{ \"global\": { \"alt-a\": \"whistle.fcous:agents\", \"alt-g\": \"whistle.focus:ghost\" } }", "error": null, "at": 0 }
  },
  "steps": [
    { "tick": 120, "model": { "problems": [{ "source": "keys.json", "detail": "global › alt-a: unknown whistle command whistle.fcous:agents" }] }, "problems": 1 }
  ]
}
```

### 11. `whistle.mode:whistle` goes to WHISTLE; switched off, its key types through

```json example whistle.mode:whistle goes to WHISTLE, and stays there
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "command": "mode:whistle", "model": { "mode": "whistle" }, "effects": [{ "focusAnchor": true }] },
    { "world": { "anchorFocused": true }, "command": "mode:whistle", "model": { "mode": "whistle" }, "effects": [] }
  ]
}
```

```json example Switched off, whistle.mode:whistle types its key into the terminal
{
  "world": {
    "focused": { "pane": "p1", "terminal": "t1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{\"enabled\":false}" },
    "keys": [{ "section": "global", "keys": "f12", "action": "whistle.mode:whistle" }]
  },
  "steps": [
    { "tick": 120 },
    { "command": "mode:whistle", "model": { "mode": "type" }, "effects": [{ "typeKey": "f12", "terminal": "t1" }] }
  ]
}
```

### 12. An unknown command, or a known one with the wrong argument, fails

It does nothing but raise `command-failed`; on a keys.json line it's a config problem too.

```json example An unknown command and a mode that isn't one raise command-failed
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "command": "nope", "model": { "mode": "type" }, "effects": [], "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "command-failed", "groups": ["command", "problem"], "command": "whistle.nope", "error": "unknown whistle command whistle.nope", "text": "unknown whistle command whistle.nope" }] } } },
    { "command": "mode:foo", "model": { "mode": "type" }, "effects": [] }
  ]
}
```

```json example keys.json lines with a mode that isn't one, or a keep-mapping with bad JSON, are config problems
{
  "world": {
    "focused": { "pane": "p1" },
    "keysFile": { "text": "{ \"global\": { \"f1\": \"whistle.mode:foo\", \"f2\": \"whistle.keep-mapping:{nope\", \"f3\": \"whistle.mode:type\" } }", "error": null, "at": 0 }
  },
  "steps": [
    { "tick": 120, "model": { "problems": [
      { "source": "keys.json", "detail": "global › f1: unknown whistle command whistle.mode:foo" },
      { "source": "keys.json", "detail": "global › f2: unknown whistle command whistle.keep-mapping:{nope" }] } }
  ]
}
```

### 13. `whistle.mappings-off:<mod>` writes the mod off into whistle.json, keeping the rest

```json example whistle.mappings-off switches a mod off in whistle.json
{
  "world": {
    "focused": { "pane": "p1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{\"hints\":false}" }
  },
  "steps": [
    { "command": "mappings-off:alpha", "effects": [
      { "write": "whistle.json", "text": "{\n  \"hints\": false,\n  \"mods\": {\n    \"alpha\": false\n  }\n}\n", "expected": "{\"hints\":false}" }
    ] }
  ]
}
```

### 14. `whistle.keep-mapping:{"mod","keys"}` writes the mod's mapping there into whistle.json

```json example whistle.keep-mapping keeps one mod's mapping in a conflict
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "beta", "type": "block", "content": { "mod": "beta" } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": {
      "alpha": { "v": 1, "map": { "g": { "name": "Alpha", "map": { "d": ["D", "alpha.d"] } } } },
      "beta": { "v": 1, "map": { "g": { "name": "Beta", "map": { "d": ["D", "beta.d"] } } } }
    }
  },
  "steps": [
    { "tick": 120 },
    { "command": "keep-mapping:{\"mod\":\"alpha\",\"keys\":[\"g\",\"d\"]}", "effects": [
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
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": { "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } } }
  },
  "steps": [
    { "tick": 120 },
    { "command": "keep-mapping:{\"mod\":\"alpha\",\"keys\":[\"x\"]}", "effects": [], "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "command-failed", "groups": ["command", "problem"], "command": "whistle.keep-mapping:{\"mod\":\"alpha\",\"keys\":[\"x\"]}", "error": "alpha maps nothing at x", "text": "alpha maps nothing at x" }] } } }
  ]
}
```

## Stable and may change

- Stable: every command and verb above, its argument's kind, the jump-key spelling
  `whistle.<verb>:<block>` (ADR 0007), the settings commands' spellings, and `subscribe`,
  `unsubscribe` and the `<mod>.whistle-event:<event>` whistle pushes.
- `whistle.subscribers`, where whistle keeps the subscriptions, is private: don't read or write
  it.
- `whistle.key-<key>` is the form whistle writes for the keys it claims in keys.json
  (see the guide). It may change; don't bind it yourself.
