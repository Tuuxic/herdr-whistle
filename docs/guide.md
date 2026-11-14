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
