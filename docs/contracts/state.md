# Whistle state

For mod authors who want to know what whistle is doing: whether it's in WHISTLE, the key
sequence typed so far, the terminal pane it has selected, which field is selected and whether
it is the terminal, and why whistle stands aside if it does. Current version: **`v: 1`**.

Read it with `whistle.js`: copy `mods/whistle/whistle.js` into your mod's folder and call
`readWhistle()` when you draw. It gives the fields below, or `null` while there's nothing to
read. The wire format below is the contract, not the helper.

```js
import { readWhistle } from "./whistle.js";

const w = readWhistle();
const label = w?.mode === "whistle" ? "whistling" : "";
```

## Shape

`shared("whistle")`:

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | The contract's version. |
| `mode` | `"type"` \| `"whistle"` | The mode: TYPE or WHISTLE. |
| `enabled` | boolean | Whether WHISTLE is switched on. |
| `sequence` | `null` \| `{ keys, group }` | The key sequence so far: `keys` a list of key names, `group` the name of the group it has reached. `null` outside a sequence. |
| `pane` | string \| `null` | The terminal pane whistle has selected, `null` until it has selected one. |
| `onTerminal` | boolean | Whether the terminal is the selected field: `true` only in WHISTLE with the terminal selected. |
| `field` | string \| `null` | The selected field's block id in WHISTLE (the terminal's, a keynav field's or a stock field's), `null` in TYPE (rule 7). |
| `inert` | `null` \| `{ problem, fix }` | Why whistle stands aside, and what the person can do about it; `null` while whistle runs (rule 8). |

Ignore fields you don't know: new ones may come under `v: 1`.

## Rules

The examples below run as tests: each is a scenario through whistle's core, and `published` is
the value whistle writes to `shared("whistle")` in that step (`null`: it writes nothing).

### 1. Whistle publishes its state when it changes, and only then

Whistle writes `shared("whistle")` once it runs, then again each time a field changes. A step
that changes nothing writes nothing, so a change of value is a change of state.

```json example Whistle publishes its state once it runs, and not again until it changes
{
  "world": { "focused": { "pane": "p1", "onTerminal": true, "field": "main", "inert": null } },
  "steps": [
    { "tick": 120, "published": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null } },
    { "tick": 120, "published": null }
  ]
}
```

### 2. `mode` is the mode

`"whistle"` while whistle holds the keyboard, `"type"` otherwise.

```json example mode follows TYPE and WHISTLE
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode", "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } },
    { "world": { "anchorFocused": true }, "command": "switch-mode",
      "published": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": false, "field": null, "inert": null } }
  ]
}
```

### 3. `enabled` says whether WHISTLE is switched on; switched off, `mode` is `"type"`

```json example Switched off, enabled is false and mode is type
{
  "world": {
    "anchorFocused": true,
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "anchor", "type": "block", "content": { "mod": "whistle", "props": { "enabled": false } } }
    ] }
  },
  "model": { "mode": "whistle" },
  "steps": [
    { "tick": 120, "published": { "v": 1, "mode": "type", "enabled": false, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null } }
  ]
}
```

### 4. `sequence` is the key sequence so far, with the group it has reached

`keys` are whistle's key names (as in the guide's Key names: `ctrl-w`, `space`, `W`), whatever
spelling the config used. `group` is the name of the group the last key opened. When the
sequence ends (a command runs, it's cancelled, or a key isn't mapped), `sequence` goes back to
`null`.

```json example A key sequence is published, and null once a command ends it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split right\", \"pane.split\", { \"direction\": \"right\" }] } } } }",
      "user": null
    }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "w",
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": { "keys": ["w"], "group": "Panes" }, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } },
    { "key": "v",
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } }
  ]
}
```

### 5. `pane` is the terminal pane whistle has selected

It's the pane whistle's moves start from and the one TYPE goes back to. It stays the same while
another field is selected, so whistle can come back to it: whether the terminal is the selected
field is `onTerminal`'s to say (rule 6).

```json example pane follows whistle's moves between panes
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "l", "published": null },
    { "world": { "focused": { "pane": "p2", "onTerminal": true, "field": "main", "inert": null } }, "tick": 120,
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p2", "onTerminal": true, "field": "main", "inert": null } }
  ]
}
```

### 6. `onTerminal` says whether the terminal is the selected field

`true` while WHISTLE is on and the terminal is the selected field; `false` in TYPE, while WHISTLE
is switched off, and while a keynav field or a stock field is selected. To mark the selected
terminal (a header that glows), check all three: `mode` is `"whistle"`, `onTerminal` is `true`
and `pane` is your pane.

```js
const w = readWhistle();
const marked = w?.mode === "whistle" && w.onTerminal && w.pane === props().pane;
```

```json example onTerminal is true in WHISTLE on the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "tick": 120, "published": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null } },
    { "command": "switch-mode", "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } }
  ]
}
```

```json example onTerminal is false while a keynav field is selected
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "tree", "type": "block", "content": { "mod": "tree" } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:tree {}": { "v": 3, "label": "Tree", "keys": {} } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l",
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": false, "field": "tree", "inert": null } },
    { "key": "ctrl-h",
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } }
  ]
}
```

```json example onTerminal is false while a stock field is selected
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "spaces", "type": "block", "content": { "mod": "spaces" } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-h",
      "published": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": false, "field": "spaces", "inert": null } }
  ]
}
```

```json example onTerminal is false in TYPE
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "command": "switch-mode",
      "published": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": false, "field": null, "inert": null } }
  ]
}
```

#### Why the terminal isn't a keynav field

Keynav's `active` is `null` both while the terminal is selected and while a stock field is, so it
can't tell you the terminal is selected. That's on purpose: keynav is how a *mod* becomes a field
(it announces itself, draws its cursor, takes `<mod>.keynav-*` commands). A terminal pane is
Herdr's own pane, not a mod; whistle drives it itself with Herdr's pane commands, as it drives
stock fields with Herdr's commands. So the terminal is whistle's own field, and whistle state
says when it is selected. See
[ADR 0015](../adr/0015-the-terminal-is-whistles-own-field.md).

### 7. `field` is the selected field's block id

In WHISTLE, the block id of the selected field: the terminal's block, a keynav field's or a stock
field's (Herdr's spaces, tabs or agents block). `null` in TYPE, while WHISTLE is switched off,
and in WHISTLE with no field to select. A client can name a stock field from it, as keynav's
`active` names only keynav fields.

```json example field names the selected stock field, and is null in TYPE
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "body", "type": "row", "children": [
        { "id": "spaces", "type": "block", "content": { "mod": "spaces" } },
        { "id": "main", "type": "block", "content": { "pane": {} } }
      ] },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode", "state": { "field": "main" } },
    { "world": { "anchorFocused": true }, "key": "ctrl-h", "state": { "field": "spaces", "onTerminal": false } },
    { "command": "switch-mode", "state": { "mode": "type", "field": null } }
  ]
}
```

### 8. Only the running whistle writes it; with none running, `inert` says why

A copy of whistle that stands aside while another copy runs writes nothing, so the state is
always the running copy's. When no copy runs (on a Herdr older than whistle needs, or with
whistle blocks that share their props, every copy stands aside), the copy that would run writes
the state once with `inert`: `problem` says why it stands aside and `fix` what the person can do,
so any mod can show it. While whistle runs, `inert` is `null`.

```json example A copy standing aside on an old Herdr publishes why, once
{
  "world": { "herdr": "0.1.14", "focused": { "pane": "p1", "onTerminal": true, "field": "main", "inert": null } },
  "steps": [
    { "tick": 120, "published": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null,
      "inert": { "problem": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)", "fix": "Update Herdr." } } },
    { "command": "switch-mode", "published": null }
  ]
}
```

```json example A copy standing aside for another copy publishes nothing
{
  "world": {
    "folder": "whistle-2", "copies": { "whistle": "2.0.0", "whistle-2": "2.0.0" },
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } },
      { "id": "anchor-2", "type": "block", "content": { "mod": "whistle-2" } }
    ] }
  },
  "steps": [
    { "tick": 120, "published": null }
  ]
}
```

### 9. `v` goes up only on a breaking change

A field removed or its meaning changed is a break: `v` goes up and the change is announced in
the CHANGELOG under **Mod authors**. New fields come under the same `v`. `whistle.js` reads
`v: 1` only, and gives `null` for any other `v`.

## Stable and may change

- Stable: `shared("whistle")` and everything above.
- Also public, each with its own page: `shared("whistle.mappings")`, for offering mappings
  ([mod-mappings.md](mod-mappings.md)), the hint items
  ([hints.md](hints.md)), the event feed ([events.md](events.md)) and the config
  ([config.md](config.md)).
- Private: every other `whistle.*` key (such as `whistle.copies`). It may change or go in any
  release; don't read or write it.

## History

- `v: 1` (whistle 1.0.0): first version.
- whistle 2.0.0: `field` and `inert`.
