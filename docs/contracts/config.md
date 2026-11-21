# Whistle config

For mod authors who want to show whistle's settings: config problems, mapping
conflicts between mods, keys mapped over mods', and the mods that offer mappings with whether
each is on. To change any of it, run whistle's
[settings commands](commands.md#settings-commands). Current version: **`v: 1`**.

Read it with `whistle.js`: copy `mods/whistle/whistle.js` into your mod's folder and call
`readConfig()` when you draw. It gives the fields below, or `null` while there's nothing to
read. The wire format below is the contract, not the helper.

```js
import { readConfig } from "./whistle.js";

const c = readConfig();
const marker = c?.problems.length ? `⚠ ${c.problems.length}` : "";
```

## Shape

`shared("whistle.config")`:

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | The contract's version. |
| `problems` | `[{ source, detail }]` | Config problems: `source` the file or place (`"mappings.json"`, `"whistle.json"`, `"layout"`, `"keys.json"`, `"keynav"`, or a mod that offers mappings under a name whistle doesn't take), `detail` what's wrong. A problem in a mod's offered mappings is listed under the mod in `mods` instead. |
| `mods` | `[{ name, on, problems }]` | The shown layout's mods that offer mappings, in layout order: `on` whether their mappings count, `problems` the details of what's wrong in them. |
| `conflicts` | `[{ keys, seq, mods, own, text, keep }]` | Mapping conflicts ([mod-mappings.md](mod-mappings.md)): `seq` the key names, `keys` them as people read them, `mods` the mods that want them, `own` the own key's action when one of them is whistle's own key (else `null`), `text` a default English line, `keep` each mod's mapping there as it wrote it, `[{ mod, value }]`. |
| `overrides` | `[{ keys, seq, by, over, text }]` | Keys a later layer maps over mods': `by` the layer (`"layout"`, `"whistle.json"`), `over` the mods, `text` a default English line. |

Fields added later under `v: 1` are optional; ignore fields you don't know.

## Rules

The examples below run as tests: each is a scenario through whistle's core, and `shared` gives
the value whistle writes to `shared("whistle.config")` in that step (`unset`: it writes
nothing).

### 1. Whistle writes the config once it runs, and again only when it changes

```json example The config is written once, then again when a mod is switched off
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "modMappings": { "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } } }
  },
  "steps": [
    { "tick": 120, "shared": { "whistle.config": { "v": 1, "problems": [], "mods": [{ "name": "alpha", "on": true, "problems": [] }], "conflicts": [], "overrides": [] } } },
    { "tick": 120, "unset": ["whistle.config"] },
    { "world": { "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ \"mods\": { \"alpha\": false } }" } }, "tick": 120,
      "shared": { "whistle.config": { "v": 1, "problems": [], "mods": [{ "name": "alpha", "on": false, "problems": [] }], "conflicts": [], "overrides": [] } } }
  ]
}
```

### 2. Conflicts carry what each mod wants, to keep one

```json example A conflict lists each mod's mapping, as the mod wrote it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "beta", "type": "block", "content": { "mod": "beta" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "modMappings": {
      "alpha": { "v": 1, "map": { "d": ["D", "alpha.d"] } },
      "beta": { "v": 1, "map": { "d": ["D", "beta.d"] } }
    }
  },
  "steps": [
    { "tick": 120, "shared": { "whistle.config": { "v": 1, "problems": [],
      "mods": [{ "name": "alpha", "on": true, "problems": [] }, { "name": "beta", "on": true, "problems": [] }],
      "conflicts": [{ "keys": "d", "seq": ["d"], "mods": ["alpha", "beta"], "own": null, "text": "alpha and beta both want d",
        "keep": [{ "mod": "alpha", "value": ["D", "alpha.d"] }, { "mod": "beta", "value": ["D", "beta.d"] }] }],
      "overrides": [] } } }
  ]
}
```

### 3. Only the running whistle writes it

```json example A copy standing aside writes no config
{
  "world": { "herdr": "0.1.14", "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120, "unset": ["whistle.config"] }
  ]
}
```

### 4. `v` goes up only on a breaking change

As for the [whistle state](state.md#9-v-goes-up-only-on-a-breaking-change). `whistle.js`
reads `v: 1` only, and gives `null` for any other `v`.

## History

- `v: 1` (whistle 2.0.0): first version.
