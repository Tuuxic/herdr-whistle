# Keynav

For mod authors who want their mod to be a **field**: a part of the window a keyboard driver
(whistle is one) can select, move around in and send keys to, without the mod knowing the
driver or the driver knowing the mod. Current version: **`v: 3`**.

Use `keynav.js`: copy `mods/whistle/keynav.js` into your mod's folder. Call
`announce(mod, props, label, keys)` when you draw, read `move(command)` and
`declared(command)` from your commands, and draw your cursor while `isActive(key)`. The wire
format below is the contract, not the helper, whose functions may change between releases.

```js
import { announce, isActive, move, declared, entered, toTerminal } from "./keynav.js";

// render:
const key = announce("files", this.props, "Files", { d: "Delete", r: "Rename" });
if (entered(this, key)) this.cursor = 0;
const showCursor = isActive(key);

// a command:
const m = move(command);      // "up" | "down" | "left" | "right" | "pick" | null
const k = declared(command);  // "d" | "r" | null
```

Whistle needs nothing from your mod beyond this, and your mod works the same without whistle.

## What goes where

Keynav carries only what every kind of field shares ([ADR 0014](../adr/0014-keynav-moves-only-what-every-field-shares.md)):

- **Moves**: up, down, left, right and **pick** (act on the item under the cursor: what that
  does is your field's to decide). The terminal and stock fields have them too.
- **Declared keys**: everything your field does on its own, such as Space to show an item or
  `d` to delete one.
- **The driver's public commands and state**: anything driver-specific. A field whose pick
  should land in whistle's TYPE runs `whistle.mode:type` after picking (docs/contracts/commands.md);
  in TYPE it does nothing, so the field needs no check of the mode.

Keynav never grows a request or a move for one driver's behaviour, and a request never names
another field: moving between fields is the driver's job.

## Shapes

A field is known by its **field key**: the mod's folder name, a space, and the block's props
as JSON with object keys sorted at every depth, objects inside arrays too (arrays keep their
order), and no spaces (`files {}`, `tree {"root":"~"}`, `tree {"roots":[{"at":"~","name":"home"}]}`). Both sides compute it from the layout, so it needs no setup.

`shared("keynav.field:<field key>")`, the field's **entry**, written by the field:

| Field | Type | Meaning |
|---|---|---|
| `v` | `3` | The contract's version. |
| `label` | string | The field's name, shown in the driver's bar while it's selected. |
| `keys` | `{ <key>: <label> }` | The field's **declared keys** and their labels for the hints. Keys are named as in whistle's guide (Key names), with no Ctrl, Alt or Super. `{}` declares none. |

`shared("keynav.request:<field key>")`, the field's **request slot**, written by the field:

| Value | Meaning |
|---|---|
| `{ after: "terminal", at }` | The field focused a terminal pane (an agent, say): the driver should select the terminal, on that pane. |
| `{ after: "hold", at }` | The field moved the keyboard somewhere (another space): the driver should keep it. |

`at` is the time of the request in ms (`Date.now()`); a driver acts on each request once. A
later kind of request would be a new value of `after`, not a new shape.

`shared("keynav")`, the driver's entry, written by the driver:

| Field | Type | Meaning |
|---|---|---|
| `v` | `3` | The newest version the driver speaks. |
| `active` | string \| `null` | The selected field's key while the driver holds the keyboard, else `null`. |

Commands the driver runs on the field's mod: `<mod>.keynav-up`, `-down`, `-left`, `-right`,
`-pick`, and `<mod>.keynav-key-<key>` for a declared key, with `<key>` as the field wrote it.

Fields added later under `v: 3` are optional; both sides ignore fields they don't know.

## Rules

The examples below run as tests: each is a scenario through whistle's core. `shared` in the
world holds the shared state as whistle reads it, by key.

### 1. A mod's block is a field once its entry says `v: 3`

The driver finds fields from the blocks in the layout and looks up each one's entry. A block
whose mod hasn't announced (or announced another `v`) isn't a field. Entries for blocks no
longer in the layout are ignored, so a field never has to clean up after itself.

```json example A field appearing: its block is a field once its entry says v 3
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l", "effects": [], "model": { "field": "main" } },
    { "world": { "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} } } }, "key": "ctrl-l",
      "effects": [{ "setShared": "keynav", "value": { "v": 3, "active": "files {}" } }],
      "model": { "field": "files" }, "state": { "field": "files" } }
  ]
}
```

### 2. The driver names the selected field in `shared("keynav")`

`active` is the selected field's key while the driver holds the keyboard, and `null` otherwise
(another kind of field selected, or back to typing). The driver writes it only when it
changes. Draw your cursor while `active` is your key. It is `null` while the terminal or a stock
field is selected too, because those are the driver's own fields, not keynav fields: to know
whether the terminal is selected, read `onTerminal` in whistle state (docs/contracts/state.md;
[ADR 0015](../adr/0015-the-terminal-is-whistles-own-field.md)).

```json example Back to TYPE, keynav names no field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l",
      "effects": [{ "setShared": "keynav", "value": { "v": 3, "active": "files {}" } }] },
    { "command": "switch-mode",
      "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }, { "setShared": "keynav", "value": { "v": 3, "active": null } }] }
  ]
}
```

### 3. Moves arrive as `<mod>.keynav-<move>`

Up, down, left, right and pick. At its edge a field decides what to do; nothing spills into
the next field. Leaving a field is always the driver's job. What pick does is the field's:
go to a space, go to an agent and type there, flip a setting.

```json example A move arrives as the mod's keynav command
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l" },
    { "key": "j", "effects": [{ "run": "files.keynav-down", "args": {} }, { "focusAnchor": true }] },
    { "key": "enter", "effects": [{ "run": "files.keynav-pick", "args": {} }, { "focusAnchor": true }] }
  ]
}
```

### 4. Declared keys beat mappings while the field is selected

A declared key arrives as `<mod>.keynav-key-<key>`, spelled as the field wrote it, even where
the driver maps that key. It counts only while the field is selected and outside a key
sequence, and whistle's hints list the declared keys with their labels meanwhile. Announce
again to change the keys at any time.

```json example A declared key beats a mapping while its field is selected
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"field-left\": [\"ctrl-h\"], \"field-right\": [\"ctrl-l\"], \"down\": [\"j\"], \"type\": [\"i\"] }, \"map\": { \"d\": [\"Next tab\", \"tab.next\"] } }",
      "user": null
    },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": { "d": "Delete" } } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "d", "effects": [{ "run": "tab.next", "args": {} }, { "focusAnchor": true }] },
    { "key": "ctrl-l", "hints": { "title": "Files", "items": [{ "key": "d", "label": "Delete", "group": false }] } },
    { "key": "d", "effects": [{ "run": "files.keynav-key-d", "args": {} }, { "focusAnchor": true }] }
  ]
}
```

### 5. Own keys beat declared keys

The driver's own keys (whistle's: selecting fields, moves, pick, back to TYPE) stay its own
while they're bound. A declared key that is one of them doesn't reach the field, and whistle's
settings list it as a config problem naming the own key, so it never fails silently. It counts
once the person unbinds that own key (in whistle.json), and the problem goes: then it is the
field's like any declared key. A declared chord is always a config problem.

```json example An own key beats a declared key, and the config problem says how to free it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": { "j": "Jump" } } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l" },
    { "key": "j", "effects": [{ "run": "files.keynav-down", "args": {} }, { "focusAnchor": true }],
      "model": { "fieldProblems": [{ "source": "keynav", "detail": "Files (files) declares j, down's own key; it counts once you unbind down" }] } }
  ]
}
```

### 6. Keys the field doesn't declare never reach it

```json example An undeclared key never reaches the field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": { "d": "Delete" } } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l" },
    { "key": "x", "effects": [], "handled": false }
  ]
}
```

### 7. Requests go in the field's own slot

After a move or key made the field focus a terminal pane, write `{ after: "terminal", at }`;
after it moved the keyboard elsewhere, `{ after: "hold", at }`. The driver reads only the
selected field's slot, acts on each request once, and ignores requests made before the field
was selected.

```json example A field asking for the terminal gets it, on the pane it focused
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l" },
    { "world": { "anchorFocused": false, "focused": { "pane": "p2" }, "shared": {
        "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} },
        "keynav.request:files {}": { "after": "terminal", "at": 50 } } },
      "tick": 120,
      "effects": [{ "focusAnchor": true }, { "setShared": "keynav", "value": { "v": 3, "active": null } }],
      "model": { "mode": "whistle", "field": "main", "pane": "p2" } }
  ]
}
```

### 8. A field that leaves stops being one

When its block leaves the layout, or its entry goes, the field is gone. If it was selected,
the driver selects the terminal and names no field.

```json example A field leaving: the terminal is selected and keynav names none
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l" },
    { "world": { "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
      ] } },
      "tick": 120,
      "effects": [{ "setShared": "keynav", "value": { "v": 3, "active": null } }],
      "model": { "field": "main" } }
  ]
}
```

### 9. `v` goes up only on a breaking change

New optional fields come under the same `v`. A driver skips an entry whose `v` it doesn't
speak: the block isn't a field, and nothing reaches it. Whistle speaks `v: 3`.

```json example An entry in a v whistle doesn't speak isn't a field
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "top", "type": "row", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "files", "type": "block", "content": { "mod": "files" } }
      ] },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "shared": { "keynav.field:files {}": { "v": 2, "label": "Files", "keys": {} } }
  },
  "steps": [
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-l", "effects": [],
      "model": { "field": "main" }, "problems": 0 }
  ]
}
```

## Checking your field

The keynav checker, in whistle's `kit/keynav-checker/`, checks your copy of `keynav.js`
against this contract. It needs only `herdr-app` (and bash):

```sh
bash kit/keynav-checker/check.sh path/to/your-mod
```

It builds a throwaway mod from the kit and your mod's `keynav.js` and loads it with
`herdr-app check`. The kit plays the driver through Herdr's own shared state: it announces a
field with your copy, sets `shared("keynav")`, hands it the commands a driver sends and reads
what it writes back. `PASS` means your copy speaks keynav v3. Otherwise the check fails and
lists each rule your copy breaks, with what it got and what it should be:

```
keynav.js breaks 1 rule of keynav v3:
  entry: announce wrote {"v":2,"label":"Check","keys":{"d":"Delete"}} to "keynav.field:keynav-check {"check":1}", want {"v":3,"label":"Check","keys":{"d":"Delete"}}
```

| Rule | What it checks |
|---|---|
| `functions` | Your copy has `fieldKey`, `announce`, `isActive`, `move`, `declared`, `entered`, `toTerminal` and `keepKeys`. A missing one fails here alone; copy whistle's current `keynav.js`. |
| `field key` | The field key's form: folder, a space, props as JSON with object keys sorted at every depth (objects inside arrays too) and no spaces. |
| `entry` | `announce` writes `{ v: 3, label, keys }` to the field's entry and returns its field key. |
| `announce again` | Announcing again changes the label and the declared keys. |
| `active` | `isActive` follows `shared("keynav").active`, for this field only. |
| `moves` | `keynav-up`, `-down`, `-left`, `-right` and `-pick` read as moves, nothing else does. |
| `declared keys` | `keynav-key-<key>` reads as the key, spelled as written. |
| `terminal request` | `toTerminal` writes `{ after: "terminal", at }` to the field's request slot, `at` in ms, and nothing else. |
| `hold request` | `keepKeys` writes `{ after: "hold", at }` to the field's request slot, and nothing else. |
| `entered` | `entered` is true once each time the field becomes active. |

`HERDR_APP=<path>` picks the `herdr-app` to run, such as the minimum Herdr your mod supports.
Without bash, copy the `kit/keynav-checker/` folder, put your `keynav.js` in the copy and run
`herdr-app check` on it. Whistle runs the checker on its own `keynav.js` in its tests.

The checker covers the helper, not your mod's own code: whether it announces from render,
handles the commands it reads and draws its cursor while active is yours to try with whistle
running.

## Stable and may change

- Stable: the field key's form, the three shared keys and their shapes, and the
  `<mod>.keynav-*` commands above.
- May change: `keynav.js`'s functions. Keep your copy; update it when the CHANGELOG says so
  under **Keynav authors**.
- The contract assumes one driver at a time.

## History

- `v: 3` (whistle 1.1.0): the version this page describes
  ([ADR 0013](../adr/0013-keynav-fields-join-by-protocol.md)).
