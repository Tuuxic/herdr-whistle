# Whistle events

For mod authors who want to know what happened in whistle: the mode switched, a key sequence
started or ended, a field was selected, a mapping ran a command, or something went wrong (a key
that isn't mapped, a command that failed, a new conflict). Each event has a stable kind, the
groups it is in, its data and a default English text. Current version: **`v: 1`**.

There are two ways to get them:

- **Pull**: read the feed, `shared("whistle.events")`, when you draw. It keeps the last 32
  events. whistle-ui does this, and flashes the events in the `problem` group.
- **Push**: subscribe, and whistle runs `<your mod>.whistle-event:<event>` for each event your
  filter passes, while your mod has a block that shows. See [Subscriptions](#subscriptions).

Read the feed with `whistle.js`: copy `mods/whistle/whistle.js` into your mod's folder, keep the
`seq` of the last event you read, and call `readEvents(last, filter)` when you draw. The wire
format below is the contract, not the helper.

```js
import { readEvents } from "./whistle.js";

let last = 0;
// In render:
const { events, last: now, missed } = readEvents(last, { groups: ["problem"] });
last = now;
for (const e of events) flash(e.kind === "key-unmapped" ? `${e.keys.join(" ")}?` : e.text);
```

## Shape

`shared("whistle.events")` is `{ v: 1, events }`, `events` the last 32 events, oldest first.
Each event:

| Field | Type | Meaning |
|---|---|---|
| `seq` | number | The event's number: 1 for the first, rising by 1 for as long as this whistle runs. |
| `kind` | string | What happened: one of the kinds below, unique across all groups. Stable. |
| `groups` | string[] | The groups the kind is in (below). An event can be in several. |
| `text` | string | A default English text for it. Short, and not UI: show your own if you like. |
| other fields | | The kind's data (below). |

## Kinds

| Kind | Data | Groups | When |
|---|---|---|---|
| `mode-switched` | `from`, `to`: `"type"` or `"whistle"` | mode | The whistle state's `mode` changed. |
| `whistle-enabled` | none | whistle | WHISTLE was switched on. |
| `whistle-disabled` | none | whistle | WHISTLE was switched off. |
| `whistle-inert` | `problem`, `fix` | whistle, problem | Whistle stands aside, with no copy running (rule 6); as the whistle state's `inert` says. |
| `whistle-active` | none | whistle | A copy that stood aside runs now. |
| `sequence-started` | `keys`, `group`: the name of the group reached | sequence | A key opened a group, outside a key sequence. |
| `sequence-ended` | `keys`: the sequence before it ended, `by`: `"ran"` (a mapping ran), `"unmapped"` (a key it doesn't map) or `"left"` (cancelled, or a jump key) | sequence | A key sequence ended. |
| `key-unmapped` | `keys`: the key names of the sequence, the last one unmapped | sequence, problem | In a key sequence, a key the group doesn't map. |
| `field-selected` | `block`: the field's block id | field | Another field is selected in WHISTLE (entering WHISTLE included). |
| `cant-select` | `block`, `reason`: `"missing"` (no such block in the shown layout), `"hidden"` (it doesn't show) or `"no-field"` (no field in it) | field, problem | `whistle.field:<block>`, or a jump key to it, can't select it. |
| `command-ran` | `command`: the command's name | command | A mapping ran its command for you: Herdr's (`pane.split`) or a mod's, or you pressed a key a keynav field declares (`tree.keynav-key-d`). Not whistle's own verbs (they show as `field-selected` or a problem), nor what whistle runs for itself (`layout.show` while revealing a block, keynav moves, writing keys.json). |
| `command-failed` | `command`, `error` | command, problem | A command whistle ran failed, a command whistle got isn't one it knows (or has the wrong argument: [commands.md](commands.md#spelling)), or a `keep-mapping` found nothing to keep ([commands.md](commands.md#settings-commands)). |
| `verb-failed` | `block`, `reason`: `"missing"` | command, problem | `whistle.focus:` or `whistle.toggle:` on a block the shown layout lacks. |
| `conflict-new` | `keys`: the key sequence, `mods`: the mods that want it | config, problem | A mapping conflict that wasn't there before ([mod-mappings.md](mod-mappings.md)). |
| `mod-problem-new` | `source`: the mod, `detail` | config, problem | A problem in a mod's offered mappings that wasn't there before. |
| `settings-unread` | none | settings, problem | A change to whistle.json asked before whistle read it. |
| `settings-broken` | `detail`: what's wrong with whistle.json | settings, problem | A change to whistle.json asked while it doesn't read, so whistle left it alone. |
| `settings-write-failed` | `error` | settings, problem | Whistle couldn't write whistle.json. |

The groups are `mode`, `whistle`, `sequence`, `field`, `command`, `config`, `settings`, and
`problem`, which holds every kind that says something went wrong. New kinds and groups may come
under `v: 1`: ignore kinds you don't know, or show their `text`.

## Reading the feed

`whistle.js` gives `readEvents(last, filter)` and, for a value you already hold,
`eventsSince(value, last, filter)`. Both return `{ events, last, missed }`:

- `events`: the events after `last` that pass `filter`, oldest first.
- `last`: the newest `seq` in the feed. It moves past **every** event read, matched or not, so a
  filtered reader never sees an old event again. Keep it for the next call.
- `missed`: how many events came after `last` but fell out of the feed before you read it (their
  `seq` is between `last` and the oldest one kept). They are gone.

`filter` is either `{ groups, kinds }`, which an event passes when it is in any listed group or
is any listed kind, or a function `(event) => boolean`. With no filter, or one naming neither
`groups` nor `kinds`, every event passes.

## Subscriptions

A mod that wants events as they happen, rather than when it draws, subscribes:

```js
import { run } from "herdr";

// On start (sending it again is harmless): every event in the mode group.
run('whistle.subscribe:{"mod":"my-mod","groups":["mode"]}');
```

| Command | Argument | Does |
|---|---|---|
| `whistle.subscribe:{"mod":"<mod>","groups":[…],"kinds":[…]}` | JSON: `mod` your mod's folder name, `groups` and `kinds` optional lists of strings | Sets the mod's whole filter, replacing any earlier one. With neither `groups` nor `kinds`, every event. |
| `whistle.unsubscribe:<mod>` | plain: the mod's name | Removes the mod's filter. Nothing if it had none. |

Then whistle runs `<mod>.whistle-event:<event as JSON>` for each event the filter passes, the
same event object the feed holds, **only while the mod has a block that shows** in the layout.
Your mod answers it like any of its commands (`nextCommand()`), and the event is everything after
the first colon. A bad argument raises `command-failed`.

- A subscription is per mod, not per copy: Herdr delivers `<mod>.whistle-event` to every copy
  that shows, in order, with nothing lost.
- A mod with no block that shows (hidden, on another layout, shown only as an overlay, or a pane
  mod) gets no push, so whistle never causes an "unknown command" toast. Read the feed when you
  show again: `missed` says if the feed dropped some.
- The filter takes `groups` and `kinds` only; a function can't be sent.
- Unsubscribe in your view's `close()` if you want to. Herdr doesn't call `close()` on hide,
  which is why whistle skips subscribers that don't show. And as the subscription is the mod's,
  one copy unsubscribing unsubscribes every copy.
- Whistle keeps the subscriptions across layout changes (each new copy of whistle reads them
  back) and while it stands aside ([rule 6](#6-who-writes-the-feed)), but not across a restart
  of Herdr: subscribe on every start.

## Rules

The examples below run as tests: each is a scenario through whistle's core. `shared` gives the
value whistle writes to `shared("whistle.events")` in that step (left out: it writes nothing),
`raised` the events raised in that step (each on the fields given), and `effects` the commands
whistle runs, pushes included.

### 1. Each event is added to the feed, which keeps the last 32

Whistle writes the feed once it runs (with no events) and again each time an event comes, once
per step whatever the step raised. An event can be in several groups: a key that isn't mapped
is both a `sequence` and a `problem` event.

```json example An unmapped key adds key-unmapped, in the sequence and problem groups
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
    { "world": { "anchorFocused": true }, "key": "w", "raised": [{ "kind": "sequence-started", "keys": ["w"], "group": "Panes" }] },
    { "key": "x", "raised": [
      { "seq": 3, "kind": "key-unmapped", "groups": ["sequence", "problem"], "text": "w x is not mapped", "keys": ["w", "x"] },
      { "seq": 4, "kind": "sequence-ended", "groups": ["sequence"], "keys": ["w"], "by": "unmapped" }] }
  ]
}
```

### 2. `seq` numbers the events in order, several in one step included

A step can add more than one event (two conflicts that came at once): each gets the next `seq`.
Keep the `seq` of the last event you read and read the ones after it, so each shows once
however many came between two draws. The feed may have dropped some by then; `missed` counts
them.

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
      { "seq": 1, "kind": "conflict-new", "groups": ["config", "problem"], "text": "d: 2 mods want it, see settings", "keys": ["d"], "mods": ["alpha", "beta"] },
      { "seq": 2, "kind": "conflict-new", "groups": ["config", "problem"], "text": "e: 2 mods want it, see settings", "keys": ["e"], "mods": ["alpha", "beta"] }] } } },
    { "tick": 120, "unset": ["whistle.events"] }
  ]
}
```

### 3. When `seq` goes back, start over

`seq` rises for as long as this whistle runs. When the newest `seq` in the feed is lower than
the last one you read, whistle started again: every event in the feed is new to you, and
`missed` is 0. `whistle.js`'s `eventsSince` does this.

### 4. A change in the whistle state is an event

Whistle compares the whistle state it publishes with the one published before (by this copy or
the copy before it): a new `mode` is `mode-switched`, a new `enabled` is `whistle-enabled` or
`whistle-disabled`, and a new `field` in WHISTLE is `field-selected`. With no state published
before (whistle just started), it compares with the state before the step: the first state is
no change by itself, but a step that changes the mode raises `mode-switched` all the same.

```json example The first step of a whistle that just started raises mode-switched when it switches
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "command": "switch-mode", "raised": [
      { "kind": "mode-switched", "groups": ["mode"], "from": "type", "to": "whistle", "text": "WHISTLE" },
      { "kind": "field-selected", "groups": ["field"], "block": "main", "text": "main selected" }] }
  ]
}
```

```json example switch-mode raises mode-switched, and field-selected for the terminal
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "tick": 120, "raised": [] },
    { "command": "switch-mode", "raised": [
      { "kind": "mode-switched", "groups": ["mode"], "from": "type", "to": "whistle", "text": "WHISTLE" },
      { "kind": "field-selected", "groups": ["field"], "block": "main", "text": "main selected" }] },
    { "world": { "anchorFocused": true }, "command": "switch-mode", "raised": [
      { "kind": "mode-switched", "from": "whistle", "to": "type", "text": "TYPE" }] }
  ]
}
```

```json example Switching WHISTLE off and on raises whistle-disabled and whistle-enabled
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120, "raised": [] },
    { "world": { "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{\"enabled\":false}" } }, "tick": 120,
      "raised": [{ "kind": "whistle-disabled", "groups": ["whistle"], "text": "Whistle off" }] },
    { "world": { "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{\"enabled\":true}" } }, "tick": 120,
      "raised": [{ "kind": "whistle-enabled", "groups": ["whistle"], "text": "Whistle on" }] }
  ]
}
```

```json example A key to another field raises field-selected
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
    { "tick": 120 },
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "ctrl-h", "raised": [{ "kind": "field-selected", "block": "spaces" }] }
  ]
}
```

### 5. A key sequence starts and ends, and a mapping's command ran

A key that opens a group outside a key sequence raises `sequence-started`. The sequence ends by
a mapping that ran (`by: "ran"`), a key it doesn't map (`"unmapped"`, after `key-unmapped`), or
otherwise (`"left"`: cancelled, or a jump key). A mapping that runs Herdr's or a mod's command
raises `command-ran`, and so does a key a keynav field declares, pressed on that field.

```json example A mapping ends the sequence and raises command-ran
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "configFiles": {
      "defaults": "{ \"keys\": { \"type\": [\"i\"], \"cancel\": [\"escape\"] }, \"map\": { \"w\": { \"name\": \"Panes\", \"map\": { \"v\": [\"Split right\", \"pane.split\"] } } } }",
      "user": null
    }
  },
  "steps": [
    { "tick": 120 },
    { "command": "switch-mode" },
    { "world": { "anchorFocused": true }, "key": "w", "raised": [
      { "kind": "sequence-started", "groups": ["sequence"], "keys": ["w"], "group": "Panes", "text": "w: Panes" }] },
    { "key": "v", "raised": [
      { "kind": "sequence-ended", "groups": ["sequence"], "keys": ["w"], "by": "ran", "text": "w: ran" },
      { "kind": "command-ran", "groups": ["command"], "command": "pane.split", "text": "ran pane.split" }] },
    { "key": "w" },
    { "key": "escape", "raised": [{ "kind": "sequence-ended", "keys": ["w"], "by": "left" }] }
  ]
}
```

### 6. Who writes the feed

The running copy writes the feed and pushes. With **no copy running** (on a Herdr older than
whistle needs, or with whistle blocks that share their props), the copy that would run raises
`whistle-inert` and writes the feed, under the same rule as the whistle state's `inert`
([state.md](state.md#8-only-the-running-whistle-writes-it-with-none-running-inert-says-why)):
once, and again only when the reason changes; a new copy (Herdr makes one whenever the layout
changes) doesn't raise it again while the whistle state's `inert` already says that reason. It
pushes nothing, but keeps the subscriptions:
`whistle.subscribe` and `whistle.unsubscribe` change them whether whistle runs or not, so a mod
that subscribes while whistle stands aside gets its pushes once whistle runs. A copy standing
aside for another copy writes nothing, subscriptions included: they are the running copy's to
keep. When a copy that stood aside runs, it raises `whistle-active`.

```json example A lone inert copy writes whistle-inert, once
{
  "world": { "herdr": "0.1.14", "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120, "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "whistle-inert", "groups": ["whistle", "problem"], "text": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)",
        "problem": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)", "fix": "Update Herdr." }] } } },
    { "tick": 120, "unset": ["whistle.events"] }
  ]
}
```

```json example A copy standing aside for another copy writes no events
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
    { "tick": 120, "unset": ["whistle.events"] }
  ]
}
```

```json example A copy that stood aside for another copy raises whistle-active when it runs
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
    { "tick": 120, "unset": ["whistle.events"] },
    { "world": { "layout": { "id": "root", "type": "column", "children": [
        { "id": "main", "type": "block", "content": { "pane": {} } },
        { "id": "anchor-2", "type": "block", "content": { "mod": "whistle-2" } }
      ] } }, "tick": 120, "raised": [{ "kind": "whistle-active", "groups": ["whistle"], "text": "Whistle runs" }] }
  ]
}
```

### 7. A subscriber that shows gets each event its filter passes

```json example A subscriber with a block that shows gets a whistle-event run
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "notes", "type": "block", "content": { "mod": "notes" } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "tick": 120 },
    { "command": "subscribe:{\"mod\":\"notes\",\"groups\":[\"mode\"]}" },
    { "command": "switch-mode", "effects": [
      { "focusAnchor": true },
      { "run": "notes.whistle-event:{\"seq\":1,\"kind\":\"mode-switched\",\"groups\":[\"mode\"],\"text\":\"WHISTLE\",\"from\":\"type\",\"to\":\"whistle\"}" }] }
  ]
}
```

```json example A subscriber whose block is hidden gets no push
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "notes", "type": "block", "hidden": true, "content": { "mod": "notes" } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "tick": 120 },
    { "command": "subscribe:{\"mod\":\"notes\",\"groups\":[\"mode\"]}" },
    { "command": "switch-mode", "effects": [{ "focusAnchor": true }], "raised": [{ "kind": "mode-switched" }, { "kind": "field-selected" }] }
  ]
}
```

```json example An unsubscribed mod gets no push
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "notes", "type": "block", "content": { "mod": "notes" } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "tick": 120 },
    { "command": "subscribe:{\"mod\":\"notes\"}" },
    { "command": "unsubscribe:notes" },
    { "command": "switch-mode", "effects": [{ "focusAnchor": true }] }
  ]
}
```

### 8. Subscribing again replaces the filter

```json example A second subscribe replaces the first filter
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "notes", "type": "block", "content": { "mod": "notes" } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" }
  },
  "steps": [
    { "tick": 120 },
    { "command": "subscribe:{\"mod\":\"notes\",\"groups\":[\"mode\"]}" },
    { "command": "subscribe:{\"mod\":\"notes\",\"kinds\":[\"field-selected\"]}" },
    { "command": "switch-mode", "effects": [
      { "focusAnchor": true },
      { "run": "notes.whistle-event:{\"seq\":2,\"kind\":\"field-selected\",\"groups\":[\"field\"],\"text\":\"main selected\",\"block\":\"main\"}" }] }
  ]
}
```

### 9. Each kind carries its data

```json example A jump key to a block the layout lacks adds verb-failed
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "command": "focus:notes", "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "verb-failed", "groups": ["command", "problem"], "text": "No notes in this layout", "block": "notes", "reason": "missing" }] } } }
  ]
}
```

```json example A field that can't be selected adds cant-select
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "command": "field:notes", "raised": [
      { "kind": "cant-select", "groups": ["field", "problem"], "text": "notes can't be selected now", "block": "notes", "reason": "missing" }] }
  ]
}
```

```json example A bad subscribe adds command-failed
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "command": "subscribe:{\"groups\":[\"mode\"]}", "effects": [], "raised": [
      { "kind": "command-failed", "groups": ["command", "problem"], "command": "whistle.subscribe:{\"groups\":[\"mode\"]}" }] }
  ]
}
```

```json example A new problem in a mod's mappings adds mod-problem-new
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "alpha", "type": "block", "content": { "mod": "alpha" } },
      { "id": "anchor", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "modMappings": { "alpha": { "v": 2, "map": {} } }
  },
  "steps": [
    { "tick": 120, "raised": [{ "kind": "mod-problem-new", "groups": ["config", "problem"], "source": "alpha", "text": "alpha's mappings have a problem, see settings" }] }
  ]
}
```

```json example A settings change before whistle.json is read adds settings-unread
{
  "world": { "focused": { "pane": "p1" }, "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }" } },
  "steps": [
    { "command": "off", "raised": [{ "kind": "settings-unread", "groups": ["settings", "problem"], "text": "whistle.json isn't read yet" }] }
  ]
}
```

```json example A settings change while whistle.json doesn't parse adds settings-broken
{
  "world": { "focused": { "pane": "p1" }, "configFiles": { "defaults": "{ \"keys\": { \"type\": [\"i\"] } }", "user": "{ nope" } },
  "steps": [
    { "tick": 120 },
    { "command": "off", "effects": [], "raised": [{ "kind": "settings-broken", "groups": ["settings", "problem"] }] }
  ]
}
```

```json example A failed write of whistle.json adds settings-write-failed
{
  "world": { "focused": { "pane": "p1" } },
  "steps": [
    { "tick": 120 },
    { "wrote": "whistle.json", "ok": false, "error": "denied", "shared": { "whistle.events": { "v": 1, "events": [
      { "seq": 1, "kind": "settings-write-failed", "groups": ["settings", "problem"], "text": "couldn't write whistle.json: denied", "error": "denied" }] } } }
  ]
}
```

### 10. `v` goes up only on a breaking change

As for the [whistle state](state.md#9-v-goes-up-only-on-a-breaking-change): a field removed or
its meaning changed, or a kind renamed or moved out of a group, is a break. New kinds, groups and
fields are not. `whistle.js` reads `v: 1` only.
