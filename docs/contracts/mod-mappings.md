# Mod mappings

For mod authors who want whistle keys for their mod's commands: offer mappings and groups, and
whistle adds them while your mod is in the shown layout. Current version: **`v: 1`**.

```js
import { shared, setShared } from "herdr";

setShared("whistle.mappings", {
  ...(shared("whistle.mappings") ?? {}),
  mymod: { v: 1, map: { g: { name: "My mod", map: { r: ["Refresh", "mymod.refresh"] } } } },
});
```

## Shape

`shared("whistle.mappings")` is `{ [mod]: { v: 1, map } }`: one entry per mod, under the
mod's name (its folder, the name its blocks carry in the layout). Write only your own entry and
keep the others.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | The contract's version. An entry of another version is skipped. |
| `map` | object | Mappings and groups in whistle's `map` format (see the guide's "Your config"): a key to `[label, command]`, `[label, command, {args}]`, `[label, command, {args}, "type"]`, or a group `{ "name", "map" }`. |

An entry only adds keys: no `null`, and no own keys or settings. A bad entry (another `v`, the
wrong form) or a bad mapping in it is skipped and listed in whistle's settings under your mod's
name; the rest still counts.

## Rules

The examples below run as tests: each is a scenario through whistle's core. `modMappings` in
the world is `shared("whistle.mappings")`.

### 1. A mod's mappings count only while the mod is in the shown layout

Your mappings sit between whistle's defaults and the layout: they go over the defaults, and the
layout's whistle block and the person's whistle.json go over them. An entry left behind after
your mod leaves the layout is ignored, not deleted.

```json example A mod mapping counts while the mod is in the layout, and not after
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "m", "type": "block", "content": { "mod": "mymod" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": { "mymod": { "v": 1, "map": { "r": ["Refresh", "mymod.refresh"] } } }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "r",
      "effects": [{ "run": "mymod.refresh", "args": {} }, { "focusBar": true }] },
    { "world": { "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
      ] } }, "tick": 120 },
    { "key": "r", "effects": [], "handled": false }
  ]
}
```

### 2. Two mods on one key count for neither

If two mods offer the same key (command against command, or command against group), neither
counts: the key falls through to the defaults, or is unmapped. The bar flashes once when the
conflict appears, and whistle's settings list it with both mods. Two groups on one key aren't a
conflict: they merge key by key, only clashing keys inside them conflict, and the group takes
the title of the mod first in layout order.

```json example Two mods on one key count for neither and flash once
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "a", "type": "block", "content": { "mod": "alpha" } },
      { "id": "b", "type": "block", "content": { "mod": "beta" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"g\": [\"Next tab\", \"tab.next\"] } }", "user": null },
    "modMappings": {
      "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } },
      "beta": { "v": 1, "map": { "g": ["Go", "beta.go"] } }
    }
  },
  "steps": [
    { "tick": 120, "bar": { "label": "g: 2 mods want it, see settings" },
      "model": { "conflicts": [{ "seq": ["g"], "mods": ["alpha", "beta"] }] } },
    { "command": "whistle" },
    { "world": { "barFocused": true }, "tick": 120, "bar": { "label": "Terminal" } },
    { "key": "g", "effects": [{ "run": "tab.next", "args": {} }, { "focusBar": true }] }
  ]
}
```

### 3. Whistle's own keys beat mod mappings

A mod mapping on one of whistle's own keys (`j`, `escape`, `ctrl-h`, ...) outside a group is a
conflict too: the own key keeps acting. Inside your groups any key is yours. If the person has
taken an own key's action away, its key is free.

```json example A mod on an own key: the own key acts
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "a", "type": "block", "content": { "mod": "alpha" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": { "alpha": { "v": 1, "map": { "i": ["Info", "alpha.info"] } } }
  },
  "steps": [
    { "tick": 120, "bar": { "label": "i: alpha wants an own key, see settings" } },
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "i",
      "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }], "bar": { "badge": "TYPE" } }
  ]
}
```

### 4. A layer above settles it; a mod can be switched off whole

The layout's whistle block or the person's whistle.json can map any mod's key, or set it to
`null`: that's an override, not a conflict, and settles a conflict on that key. Settings label
it ("you, over alpha"); nothing flashes. Either can also switch a mod off whole with a `mods`
section, `{ "mods": { "alpha": false } }`; whistle.json's goes over the layout's.

```json example whistle.json switches a mod off, settling its conflict
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "a", "type": "block", "content": { "mod": "alpha" } },
      { "id": "b", "type": "block", "content": { "mod": "beta" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }", "user": "{ \"mods\": { \"alpha\": false } }" },
    "modMappings": {
      "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } },
      "beta": { "v": 1, "map": { "g": ["Go", "beta.go"] } }
    }
  },
  "steps": [
    { "tick": 120, "model": { "conflicts": [] } },
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "g",
      "effects": [{ "run": "beta.go", "args": {} }, { "focusBar": true }] }
  ]
}
```

```json example The layout mapping a mod's key is an override, without a flash
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "a", "type": "block", "content": { "mod": "alpha" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": {
        "mappings": { "g": ["Previous tab", "tab.prev"] } } } }
    ] },
    "focused": { "pane": "p1" },
    "modMappings": { "alpha": { "v": 1, "map": { "g": ["Go", "alpha.go"] } } }
  },
  "steps": [
    { "tick": 120, "bar": { "label": "Terminal" },
      "model": { "overrides": [{ "seq": ["g"], "source": "layout", "over": ["alpha"] }] } }
  ]
}
```

### 5. Chords are claimed

A chord in your mappings (`ctrl-g`) is claimed in keys.json like any of whistle's keys, so it
reaches whistle in WHISTLE. A conflicting chord is claimed only while a lower layer still maps
it, so Herdr's own binding keeps working until the conflict is settled.
