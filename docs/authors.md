# Building on whistle

For anyone writing a layout or a mod that works with whistle. Whistle knows no other mod by
name: everything below goes through Herdr's shared state, keys.json and the layout, in eight
contracts. Pick the one that fits your job.

## Which contract

| You want to | Read | Copy |
|---|---|---|
| place whistle's bar in your layout, tune it for your layout's mods (mappings, `nav`, a switched-off layout, bar spots) | [The layout's whistle block](contracts/layout-block.md) | nothing |
| make your mod a **field**: whistle selects it, moves a cursor in it and sends it the keys it declares | [Keynav](contracts/keynav.md) | [`keynav.js`](../mods/whistle/keynav.js) |
| give your mod's commands whistle keys (mappings and groups, added while your mod shows) | [Mod mappings](contracts/mod-mappings.md) | [`whistle.js`](../mods/whistle/whistle.js) |
| know what whistle is doing: the mode, the key sequence, the terminal it has selected, why it stands aside | [Whistle state](contracts/state.md) | [`whistle.js`](../mods/whistle/whistle.js) |
| show what the next key does: the choices of the key sequence, or the selected field's declared keys | [Whistle hints](contracts/hints.md) | [`whistle.js`](../mods/whistle/whistle.js) |
| tell people what just happened: an unmapped key, a failed command, a new conflict (kind, data, default text) | [Whistle events](contracts/events.md) | [`whistle.js`](../mods/whistle/whistle.js) |
| show whistle's settings: config problems, conflicts, overrides, mods on or off (and change them with the settings commands) | [Whistle config](contracts/config.md) | [`whistle.js`](../mods/whistle/whistle.js) |
| bind whistle's commands in keys.json, run them from your mod (the settings commands included), or map its verbs | [Whistle's commands](contracts/commands.md) | nothing |

Each contract has the same outline: who it's for and its current `v`, the shapes, numbered
rules each with an example (the examples run as whistle's tests, so they're exactly what
whistle does), what's stable and what may change, and its history.

## The helpers

Copy them from whistle's [`mods/whistle/`](../mods/whistle) into your mod's folder (a mod can't
import from another's). The contracts are the wire formats, not the helpers' functions.

- [`keynav.js`](../mods/whistle/keynav.js): announce your field, read moves and declared keys,
  know when to draw your cursor, ask for the terminal or to hold the keyboard.
- [`whistle.js`](../mods/whistle/whistle.js): `readWhistle()`, `readHints()`, `readEvents(last)` and
  `readConfig()` for whistle's public keys, and
  `offerMappings(mod, map)` for your mappings.

## Checking your field

The [keynav checker](../kit/keynav-checker) checks your copy of `keynav.js` against keynav v3
with `herdr-app check`:

```sh
bash kit/keynav-checker/check.sh path/to/your-mod
```

It covers the helper, not your view: see [Checking your field](contracts/keynav.md#checking-your-field).

## Versions and breaks

Whistle's version follows semver over all eight contracts and both helpers
([ADR 0012](adr/0012-main-is-the-release-whistle-carries-its-own-version.md)). Keynav, mod
mappings, whistle state, hints, events and config carry their own `v`, which goes up only on a breaking change; a
reader ignores fields it doesn't know. Every change for you is in the
[CHANGELOG](../CHANGELOG.md) under **Layout authors**, **Mod authors** or **Keynav authors**,
breaking ones marked **Breaking**.
