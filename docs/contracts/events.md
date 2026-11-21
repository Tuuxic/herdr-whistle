# Whistle events

For mod authors who want to tell people what just happened in whistle: a key that isn't mapped,
a block that can't be selected, a command that failed, a new conflict. Each event has a stable
kind, its data and a default English text; whistle-ui's bar flashes that text. Current
version: **`v: 1`**.

Read it with `whistle.js`: copy `mods/whistle/whistle.js` into your mod's folder, keep the `seq`
of the last event you handled, and call `readEvents(last)` when you draw. It gives the events
that came since and the new `last`. The wire format below is the contract, not the helper.

```js
import { readEvents } from "./whistle.js";

let last = 0;
// In render:
const { events, last: now } = readEvents(last);
last = now;
for (const e of events) flash(e.kind === "unmapped" ? `${e.keys.join(" ")}?` : e.text);
```

## Shape

`shared("whistle.events")` is `{ v: 1, events }`, `events` the last 8 events, oldest first.
Each event:

| Field | Type | Meaning |
|---|---|---|
| `seq` | number | The event's number: 1 for the first, rising by 1 for as long as this whistle runs. |
| `kind` | string | What happened: one of the kinds below. Stable. |
| `text` | string | A default English text for it, as whistle-ui's bar flashes it. |
| other fields | | The kind's data (below). |

| Kind | Data | When |
|---|---|---|
| `unmapped` | `keys`: the key names of the sequence, the last one unmapped | In a key sequence, a key the group doesn't map. |
| `cant-select` | `block`, `reason`: `"missing"` (no such block in the shown layout), `"hidden"` (it doesn't show) or `"no-field"` (no field in it) | `whistle.field:<block>`, or a jump key to it, can't select it. |
| `verb-failed` | `block`, `reason`: `"missing"` | `whistle.focus:` or `whistle.toggle:` on a block the shown layout lacks. |
| `command-failed` | `command`, `error` | A command whistle ran failed, a command whistle got isn't one it knows (or has the wrong argument: [commands.md](commands.md#spelling)), or a `keep-mapping` found nothing to keep ([commands.md](commands.md#settings-commands)). |
| `conflict-new` | `keys`: the key sequence, `mods`: the mods that want it | A mapping conflict that wasn't there before ([mod-mappings.md](mod-mappings.md)). |
| `mod-problem-new` | `source`: the mod, `detail` | A problem in a mod's offered mappings that wasn't there before. |
| `settings-unread` | none | A change to whistle.json asked before whistle read it. |
| `settings-broken` | `detail`: what's wrong with whistle.json | A change to whistle.json asked while it doesn't read, so whistle left it alone. |
| `settings-write-failed` | `error` | Whistle couldn't write whistle.json. |

New kinds may come under `v: 1`: ignore kinds you don't know, or show their `text`.

## Rules

The examples below run as tests: each is a scenario through whistle's core, and `shared` gives
the value whistle writes to `shared("whistle.events")` in that step (left out: it writes
nothing).

### 1. Each event is added to the feed, which keeps the last 8

Whistle writes the feed once it runs (with no events) and again each time an event comes.

```json example An unmapped key adds an unmapped event
{
  "world": {
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split right\", \"pane.split\"] } } } }",
      "user": null
    }
  },
  "steps": [
    { "tick": 120, "shared": { "whistle.events": { "v": 1, "events": [] } } },
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "w", "unset": ["whistle.events"] },
    { "key": "x", "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "unmapped", "keys": ["w", "x"], "text": "w x is not mapped" }] } } }
  ]
}
```

### 2. `seq` numbers the events in order, several in one step included

A step can add more than one event (two conflicts that came at once): each gets the next `seq`.
Keep the `seq` of the last event you handled and show the ones after it, so each shows once
however many came between two draws. The feed may have dropped some by then; those are gone.

```json example Two new conflicts in one step get consecutive seqs
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "beta", "type": "block", "content": { "mod": "beta" } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "modMappings": {
      "alpha": { "v": 1, "map": { "d": ["D", "alpha.d"], "e": ["E", "alpha.e"] } },
      "beta": { "v": 1, "map": { "d": ["D", "beta.d"], "e": ["E", "beta.e"] } }
    }
  },
  "steps": [
    { "tick": 120, "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "conflict-new", "keys": ["d"], "mods": ["alpha", "beta"], "text": "d: 2 mods want it, see settings" },
      { "seq": 2, "kind": "conflict-new", "keys": ["e"], "mods": ["alpha", "beta"], "text": "e: 2 mods want it, see settings" }] } } },
    { "tick": 120, "unset": ["whistle.events"] }
  ]
}
```

### 3. When `seq` goes back, start over

`seq` rises for as long as this whistle runs. When the newest `seq` in the feed is lower than
the last one you handled, whistle started again: every event in the feed is new to you.
`whistle.js`'s `eventsSince` does this.

### 4. Each kind carries its data

```json example A jump key to a block the layout lacks adds verb-failed
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "command": "focus:notes", "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "verb-failed", "block": "notes", "reason": "missing", "text": "No notes in this layout" }] } } }
  ]
}
```

```json example A failed write of whistle.json adds settings-write-failed
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "wrote": "whistle.json", "ok": false, "error": "denied", "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "settings-write-failed", "error": "denied", "text": "couldn't write whistle.json: denied" }] } } }
  ]
}
```

### 5. Only the running whistle writes it

A copy of whistle that stands aside writes nothing here.

```json example A copy standing aside writes no events
{
  "world": { "herdr": "0.1.14", "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120, "unset": ["whistle.events"] }
  ]
}
```

### 6. `v` goes up only on a breaking change

As for the [whistle state](state.md#9-v-goes-up-only-on-a-breaking-change): a field removed or
its meaning changed, or a kind renamed, is a break. New kinds and new fields are not.
`whistle.js` reads `v: 1` only.

## History

- `v: 1` (whistle 2.0.0): first version.
