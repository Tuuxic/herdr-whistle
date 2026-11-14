# Whistle guide

## Key names

Whistle names keys the way Herdr's `keys.json` does: the key, with any modifiers in front,
joined by `-` (`ctrl-h`, `alt-shift-x`, `super-k`, `shift-tab`, `f2`, `space`). Any spelling
Herdr accepts works, and comes down to one name:

| You write | Whistle reads | Why |
|---|---|---|
| `cmd-k`, `win-k`, `super-k` | `super-k` | Cmd on macOS, the Windows key elsewhere: one modifier |
| `secondary-k` | `super-k` on macOS, `ctrl-k` elsewhere | as in Herdr |
| `shift-ctrl-x`, `alt-ctrl-h` | `ctrl-shift-x`, `ctrl-alt-h` | modifiers in any order; whistle's is ctrl, alt, super, shift |
| `Ctrl-x`, `Enter`, `F2` | `ctrl-x`, `enter`, `f2` | modifiers and named keys in any case |
| `ctrl-X` | `ctrl-shift-x` | an uppercase letter in a chord means Shift, as in Herdr |
| `X`, `shift-x` | `X` | a key on its own is the character it types |

Write shifted punctuation as the character it types: `ctrl-?`, not `ctrl-shift-/`, since which
key gives `?` depends on the keyboard layout. `option` and `fn` aren't modifiers (on macOS
Option is `alt`), and a key sequence (`ctrl-a b`) isn't one key.

## Whistle edits your keys.json

Herdr runs `keys.json` before whistle sees a key, so a key another section binds (a layout's
Ctrl+H) would never reach whistle. Whistle claims the keys it needs in the `"mod:whistle"`
section, which wins while whistle has the keyboard:

```json
"mod:whistle": {
  "ctrl-space": "whistle.type",
  "ctrl-h": "whistle.key-ctrl-h"
}
```

It claims every Ctrl, Alt or Super chord among its keys, and any other of its keys that the
`global` section or the shown layout's section binds. `whistle.key-<key>` is only how whistle
writes a claim; don't bind it yourself.

- Whistle owns only entries of exactly that form. Your own entries in `"mod:whistle"` stay as
  you wrote them and win: a key you bind there, in any spelling, isn't claimed.
- It writes only when its claims change, never while `keys.error` reports a problem, and never
  when you have no `keys.json` (writing one would replace Herdr's defaults).
- If Herdr rejects what it wrote, whistle puts the old text back and doesn't try that text again.
- Herdr stops adding new default shortcuts to a `keys.json` that was edited, so the first claim
  ends those upgrades.

A claimed key acts as if pressed on the bar:

```json example A claimed key in WHISTLE acts as the key pressed
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
    { "world": { "barFocused": true }, "command": "key-i",
      "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }],
      "bar": { "badge": "TYPE" } }
  ]
}
```

## Your config

Whistle's config comes in layers, each over the one before:

1. **The defaults**: `mods/whistle/mappings.json`. An update replaces it, so don't edit it.
2. **The layout's whistle block**: its `mappings` and `keys` props, for keys that suit that
   layout's mods.
3. **Yours**: `whistle.json` in Herdr's home (`~/.config/herdr-app/whistle.json`). Nothing
   replaces it.

Each layer has two sections, kept apart:

```json
{
  "map": {
    "n": ["Next tab", "tab.next"],
    "1": ["Space 1", "space.select:1"],
    "w": { "name": "Panes", "map": {
      "v": ["Split right", "pane.split", { "direction": "right" }],
      "q": null
    } }
  },
  "keys": { "type": ["i", "q"], "back": null }
}
```

- **`map`**, the mappings: a key to `[label, command]`, `[label, command, {args}]`, or a group
  `{ "name", "map" }` whose keys follow it (`w` then `v`); groups nest. A command is any
  `herdr-app commands` name, or a mod's `<mod>.<command>`; `name:value` fills its first
  argument, as in `keys.json`. A mapping goes over an own key.
- **`keys`**, whistle's own keys: an action to its list of keys. The actions: `field-left`,
  `field-down`, `field-up`, `field-right` (select the field that way), `left`, `down`, `up`,
  `right` (move inside it), `open`, `type` (back to TYPE), `cancel` (end a key sequence) and
  `back` (up one level in it).
- A key set to `null` takes it away; groups merge key by key, so a layer can add to a group or
  take one key out of it. An action's list replaces the one below; `null` leaves the action
  with no keys.
- Keys are written as in [Key names](#key-names); any spelling counts.

```json example whistle.json goes over the layout, which goes over the defaults
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle", "props": {
        "mappings": { "n": ["Previous tab", "tab.prev"], "p": ["Previous tab", "tab.prev"] } } } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"n\": [\"Next tab\", \"tab.next\"] } }",
      "user": "{ \"map\": { \"n\": [\"Next space\", \"space.next\"] } }"
    }
  },
  "steps": [
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "n",
      "effects": [{ "run": "space.next", "args": {} }, { "focusBar": true }] },
    { "key": "p", "effects": [{ "run": "tab.prev", "args": {} }, { "focusBar": true }] }
  ]
}
```

### Mods' mappings

Mods can offer whistle mappings of their own ([the contract](contracts/mod-mappings.md)). They
sit between the defaults and the layout, and count only while the mod has a block in the shown
layout. Your whistle.json and the layout can map over any of them, or set a key to `null`.

- **A mapping conflict**: two mods on one key, or a mod on one of whistle's own keys, counts
  for neither. The key keeps what the defaults give it (or the own key keeps acting), the bar
  flashes once ("g: 2 mods want it, see settings") and settings list it. Map the key yourself,
  or switch one mod off, to settle it.
- **Switching a mod off**: a `mods` section takes a mod's mappings out whole, in whistle.json
  or the layout's whistle block (whistle.json's goes over the layout's):

```json
{ "mods": { "alpha": false } }
```

### When something is wrong

Whistle works around what's wrong in its config and lists each **config problem** in its
settings, with the file and what's wrong, until it's fixed. While there are any, the bar shows
a short marker (⚠ and how many) at its end, in TYPE and WHISTLE alike.

- **A file that doesn't parse** runs on its last version that did, from this session. With
  none, whistle leaves `whistle.json` out; with no `mappings.json` at all (missing, or broken
  from the start) it runs on a few safety own keys built into it, so WHISTLE never traps the
  keyboard (`ctrl-h/j/k/l`, `h/j/k/l` and the arrows, `enter`, `i`, `escape`, `backspace`),
  and calls it a broken install.
- **An entry that makes no sense** (an unknown command, a key name whistle can't read, an
  unknown action, an entry of the wrong form) is skipped and listed; the rest of its file
  counts.
- **A command that fails when pressed** only flashes in the bar, until the next key.
- **keys.json is never written** while one of whistle's files doesn't parse, while
  `mappings.json` is missing, or while `keys.json` itself doesn't parse or `keys.error`
  exists. Whistle looks again every second, so its claims come back by themselves once the
  file is fixed.

```json example A whistle.json that breaks runs on its last good version
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }",
      "user": "{ \"map\": { \"n\": [\"Next tab\", \"tab.next\"] } }"
    }
  },
  "steps": [
    { "tick": 120, "bar": { "marker": null } },
    { "world": { "configFiles": {
        "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": {} }",
        "user": "{ \"map\": { \"n\": [\"Next tab\", " } }, "tick": 1000,
      "model": { "problems": [{ "source": "whistle.json", "detail": "doesn't parse; whistle runs on its last good version" }] },
      "bar": { "marker": "⚠ 1" } },
    { "command": "whistle" },
    { "world": { "barFocused": true }, "key": "n",
      "effects": [{ "run": "tab.next", "args": {} }, { "focusBar": true }] }
  ]
}
```
