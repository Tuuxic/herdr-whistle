# Whistle hints

For mod authors who want to show what the next key does: the choices of the key sequence typed
so far, or the keys the selected field declares. Current version: **`v: 1`**. Since whistle
2.0.0.

Read it with `whistle.js`: copy `mods/whistle/whistle.js` into your mod's folder and call
`readHints()` when you draw. It gives the fields below, or `null` while there's nothing to show
or nothing to read. The wire format below is the contract, not the helper.

```js
import { readHints } from "./whistle.js";

const h = readHints();
const lines = h ? h.items.map((i) => `${i.key} ${i.group ? "+" : ""}${i.label}`) : [];
```

## Shape

`shared("whistle.hints")` is `null` or:

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | The contract's version. |
| `keys` | string | The key sequence so far, as people read it (`"w m"`, `"Ctrl+W"`), `""` outside one. |
| `title` | string | The group the sequence reached, or the selected field's label. |
| `items` | `[{ key, label, group }]` | The choices, in the config's order: `key` as people read it, `label` what it does, `group` whether it opens a group. |
| `exit` | string \| `null` | What ends the sequence (`"Esc cancels"`), `null` when no key does or outside one. |

Fields added later under `v: 1` are optional; ignore fields you don't know.

## Rules

The examples below run as tests: each is a scenario through whistle's core, and `shared` gives
the value whistle writes to `shared("whistle.hints")` in that step (left out: it writes
nothing).

### 1. Whistle writes the hints when they change, and only then

Whistle writes `shared("whistle.hints")` once it runs, then again each time the items change. A
step that changes nothing writes nothing.

### 2. In a key sequence, the hints are the group it reached

```json example The hints are the group a key sequence reached, and null once it ends
{
  "world": {
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"], \"cancel\": [\"escape\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split right\", \"pane.split\"], \"m\": { \"name\": \"Move\", \"map\": {} } } } } }",
      "user": null
    }
  },
  "steps": [
    { "tick": 120, "shared": { "whistle.hints": null } },
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "w", "shared": { "whistle.hints": { "v": 1, "keys": "w", "title": "Panes", "exit": "Esc cancels",
      "items": [{ "key": "v", "label": "Split right", "group": false }, { "key": "m", "label": "Move", "group": true }] } } },
    { "tick": 120, "unset": ["whistle.hints"] },
    { "key": "v", "shared": { "whistle.hints": null } }
  ]
}
```

### 3. Outside a sequence, the hints are the selected field's declared keys

A keynav field that declares keys ([keynav.md](keynav.md)) gets them listed while it's
selected and no sequence is under way: `keys` is `""` and `title` the field's label.

```json example Outside a sequence, the hints list the selected keynav field's declared keys
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "tree", "type": "block", "content": { "mod": "tree" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:tree {}": { "v": 3, "label": "Tree", "keys": { "r": "Rename" } } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "ctrl-l", "shared": { "whistle.hints": { "v": 1, "keys": "", "title": "Tree", "exit": null,
      "items": [{ "key": "r", "label": "Rename", "group": false }] } } }
  ]
}
```

### 4. The hints don't depend on whether whistle's hints box is on

The hints are what *could* be shown. Switching whistle's own hints box off (`hints: false` in
the layout's whistle block or whistle.json) changes nothing here: whether to show them is your
call.

```json example The hints are written with whistle's own hints box switched off
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": { "hints": false } } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split right\", \"pane.split\"] } } } }",
      "user": null
    }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "barFocused": true }, "key": "w", "shared": { "whistle.hints": { "v": 1, "keys": "w", "title": "Panes", "exit": null,
      "items": [{ "key": "v", "label": "Split right", "group": false }] } } }
  ]
}
```

### 5. Only the running whistle writes it

A copy of whistle that stands aside writes nothing here (see the state's
[rule 7](state.md#7-only-the-running-whistle-writes-it-with-none-running-inert-says-why)).

```json example A copy standing aside writes no hints
{
  "world": { "herdr": "0.1.14", "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120, "unset": ["whistle.hints"] }
  ]
}
```

### 6. `v` goes up only on a breaking change

As for the [whistle state](state.md#8-v-goes-up-only-on-a-breaking-change). `whistle.js`
reads `v: 1` only, and gives `null` for any other `v`.

## History

- `v: 1` (whistle 2.0.0): first version. Before, the items were private, in a key of the same
  name; that private key moved.
