# whistle-ui

For layout authors who place whistle's bar and hints box, and for anyone who wants to replace
them. whistle-ui is a separate mod, `mods/whistle-ui/`, shipped with whistle: the bar, the
hints box and the settings dialog. It is a client of whistle's public contract and nothing
more: it reads [the whistle state](state.md), [the hints](hints.md), [the events](events.md)
and [the config](config.md), and runs [whistle's commands](commands.md). It runs no part of
whistle, reads none of whistle's files and claims no keys, so whistle works the same with
whistle-ui, without it, or with your own client in its place.

```json
[
  { "id": "whistle-anchor", "type": "block", "size": { "px": 0 }, "content": { "mod": "whistle" } },
  { "id": "whistle-bar", "type": "block", "size": { "px": 22 }, "content": { "mod": "whistle-ui", "props": { "hintsGap": 6 } } },
  { "id": "whistle-corner", "type": "block", "size": { "px": 0 }, "content": { "mod": "whistle-ui", "props": { "corner": true } } }
]
```

## Blocks and props

A whistle-ui block is a **bar** unless its props say `corner: true`; then it is the **corner
block**, which draws nothing (size it 0 px) and shows the hints box when no bar shows. Herdr
tells a mod's blocks apart only by their props, so give each whistle-ui block props of its
own.

| Prop | Type | Meaning |
|---|---|---|
| `corner` | boolean | `true` makes this block the corner block. |
| `hints` | boolean | `false`: this block never shows the hints box. Default `true`. |
| `hintsAlignRight` | number | A bar's: px from the window's right edge to the bar block's outer edge (its border included). Default 0. |
| `hintsAlignBorder` | number | A bar's: the width in px of the border the layout draws around it. Default 0. |
| `hintsGap` | number | A bar's: px between the bar block's top and the hints box. Default 6. |

The **lead** block shows the hints box and opens the settings: the first bar in layout order
that shows, else the corner block if it shows. Herdr doesn't load a hidden block, so with every
bar hidden only the corner block can show the hints.

Its one command, `whistle-ui.settings`, is bound to `alt-,` in `mods/whistle-ui/keys.json`.

## Rules

The examples below run as tests: each feeds whistle-ui's core (`mods/whistle-ui/ui.js`) the
values whistle publishes (`published`, by key: `whistle`, `hints`, `events`, `config`) and the
world a copy sees, and checks what the bar draws (`bar`), the overlays it opens or closes
(`effects`), or, for a `command`, the effects it carries out. Whistle's core never runs in
them.

### 1. A bar shows the mode and where the keyboard is

The badge says TYPE or WHISTLE. In TYPE the label says `Terminal` while a terminal pane has
focus. In WHISTLE it names the terminal's selected pane, the selected keynav field's label
([keynav.md](keynav.md): `active` and the field's entry), or a stock field's name (`Spaces`,
`Tabs` or `Agents`, from the whistle state's `field` and that block's mod).

```json ui-example In WHISTLE on the terminal, the bar names the pane
{
  "published": { "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": true, "field": "main", "inert": null } },
  "world": { "panes": [{ "pane": "p1", "title": "zsh" }] },
  "bar": { "badge": "WHISTLE", "label": "Terminal · zsh", "marker": null }
}
```

```json ui-example In WHISTLE on a stock field, the bar says its name
{
  "published": { "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": "p1", "onTerminal": false, "field": "spaces", "inert": null } },
  "world": { "layout": { "id": "root", "type": "column", "children": [
    { "id": "spaces", "type": "block", "content": { "mod": "spaces" } },
    { "id": "main", "type": "block", "content": { "pane": {} } },
    { "id": "whistle-anchor", "type": "block", "content": { "mod": "whistle" } },
    { "id": "whistle-bar", "type": "block", "content": { "mod": "whistle-ui" } },
    { "id": "whistle-corner", "type": "block", "content": { "mod": "whistle-ui", "props": { "corner": true } } }
  ] } },
  "bar": { "badge": "WHISTLE", "label": "Spaces", "marker": null }
}
```

```json ui-example In WHISTLE on a keynav field, the bar says the field's label
{
  "published": { "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null } },
  "world": { "shared": { "keynav": { "v": 3, "active": "files {}" }, "keynav.field:files {}": { "v": 3, "label": "Files", "keys": {} } } },
  "bar": { "badge": "WHISTLE", "label": "Files", "marker": null }
}
```

### 2. Config problems show as a count; switched off, the bar says so

```json ui-example Switched off with two config problems
{
  "published": {
    "whistle": { "v": 1, "mode": "type", "enabled": false, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null },
    "config": { "v": 1, "problems": [{ "source": "layout", "detail": "a" }, { "source": "keys.json", "detail": "b" }], "mods": [], "conflicts": [], "overrides": [] }
  },
  "bar": { "badge": null, "label": "Whistle off", "marker": "⚠ 2" }
}
```

### 3. With whistle inert or not running, the bar says that and nothing else

```json ui-example Whistle inert: the bar says why
{
  "published": { "whistle": { "v": 1, "mode": "type", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null,
    "inert": { "problem": "Whistle needs Herdr 0.1.15 or later", "fix": "Update Herdr" } } },
  "bar": { "badge": null, "label": "", "marker": null, "problem": "Whistle needs Herdr 0.1.15 or later" }
}
```

```json ui-example No whistle state: whistle isn't running
{
  "published": {},
  "bar": { "badge": null, "label": "Whistle isn't running", "marker": null }
}
```

### 4. Each event flashes once, for 2 s or until the key sequence changes

A bar shows the text of each event that came since it last drew, in place of its label; several
at once show together. A copy remembers the last event's `seq` it handled and keeps it in
`whistle-ui.seen`, so a new copy (Herdr makes one when the layout changes) goes on from there.
With nothing kept yet, a new copy flashes none of the events already in the feed. When the
newest `seq` is lower than the one kept, whistle started again and every event is new.

```json ui-example A new event flashes its text
{
  "published": {
    "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null },
    "events": { "v": 1, "events": [{ "seq": 4, "kind": "unmapped", "keys": ["w", "x"], "text": "w x is not mapped" }] }
  },
  "world": { "last": 3 },
  "bar": { "badge": "WHISTLE", "label": "w x is not mapped", "marker": null }
}
```

### 5. The lead bar docks the hints box on top of itself

While whistle is in WHISTLE with hints to show, the lead bar opens the box as wide as the bar
block and `hintsGap` above it, and closes it when `whistle.hints` goes back to `null`.

```json ui-example The lead bar docks the hints on itself
{
  "published": {
    "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": { "keys": ["w"], "group": "Panes" }, "pane": null, "onTerminal": false, "field": null, "inert": null },
    "hints": { "v": 1, "keys": "w", "title": "Panes", "items": [{ "key": "v", "label": "Split right", "group": false }], "exit": "Esc cancels" }
  },
  "world": { "size": { "width": 1000, "height": 22 }, "viewport": { "width": 1000, "height": 600 } },
  "effects": [{ "openOverlay": "hints", "spec": { "mod": "whistle-ui", "kind": "window", "frame": "none", "width": 1000, "height": 50,
    "at": { "x": 0, "y": 522 }, "props": { "part": "hints", "width": 1000 } } }]
}
```

### 6. With no bar shown, the corner block shows the hints at the window's bottom right

The box is 480 px wide (the window's width less 12 px, if narrower), 6 px in from the window's
right and bottom edges.

```json ui-example No bar shown: the corner block shows the hints at the bottom right
{
  "published": {
    "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": { "keys": ["w"], "group": "Panes" }, "pane": null, "onTerminal": false, "field": null, "inert": null },
    "hints": { "v": 1, "keys": "w", "title": "Panes", "items": [{ "key": "v", "label": "Split right", "group": false }], "exit": "Esc cancels" }
  },
  "world": {
    "props": { "corner": true }, "viewport": { "width": 1000, "height": 600 },
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "whistle-bar", "type": "block", "hidden": true, "content": { "mod": "whistle-ui" } },
      { "id": "whistle-corner", "type": "block", "content": { "mod": "whistle-ui", "props": { "corner": true } } }
    ] }
  },
  "effects": [{ "openOverlay": "hints", "spec": { "mod": "whistle-ui", "kind": "window", "frame": "none", "width": 480, "height": 50,
    "at": { "x": 514, "y": 544 }, "props": { "part": "hints", "width": 480 } } }]
}
```

### 7. `hints: false` keeps a block from showing the hints box

```json ui-example A bar with hints false opens no hints box
{
  "published": {
    "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": { "keys": ["w"], "group": "Panes" }, "pane": null, "onTerminal": false, "field": null, "inert": null },
    "hints": { "v": 1, "keys": "w", "title": "Panes", "items": [{ "key": "v", "label": "Split right", "group": false }], "exit": "Esc cancels" }
  },
  "world": { "props": { "hints": false }, "layout": { "id": "root", "type": "column", "children": [
    { "id": "whistle-bar", "type": "block", "content": { "mod": "whistle-ui", "props": { "hints": false } } }
  ] } },
  "effects": []
}
```

### 8. `whistle-ui.settings` goes back to TYPE, then opens the settings dialog

The dialog takes the keyboard, so whistle-ui runs `whistle.mode:type` first. The dialog lists
`whistle.config` and changes it only through whistle's
[settings commands](commands.md#settings-commands): a mod's switch runs
`whistle.mappings-on:<mod>` or `whistle.mappings-off:<mod>`, and "Keep <mod>'s" on a conflict
runs `whistle.keep-mapping:{"mod":"<mod>","keys":[…]}` with the conflict's `seq`. A change that
fails comes back as an event, which the bar flashes.

```json ui-example whistle-ui.settings in WHISTLE
{
  "published": { "whistle": { "v": 1, "mode": "whistle", "enabled": true, "sequence": null, "pane": null, "onTerminal": false, "field": null, "inert": null } },
  "command": "settings",
  "effects": [{ "run": "whistle.mode:type" },
    { "openOverlay": "settings", "spec": { "mod": "whistle-ui", "kind": "dialog", "width": 640, "height": 0.8, "props": { "part": "settings" } } }]
}
```

## Replacing a part

Each part reads only the public keys, so you can drop any of them and draw your own:

- **The bar**: leave out whistle-ui's bars and draw whistle state, the config's problem count
  and the events your way. Keep the corner block if you still want whistle-ui's hints box.
- **The hints box**: give every whistle-ui block `hints: false`, and draw `whistle.hints` in
  your own mod.
- **The settings dialog**: bind your own command in place of `whistle-ui.settings`, read
  `whistle.config` and run the settings commands.
- **All of it**: leave whistle-ui out of the layout and keys.json. Whistle runs the same.

whistle-ui keeps two private shared keys of its own, which no other mod reads or writes:

- `whistle-ui.overlay:<name>`: the id of the overlay open under `<name>` (`hints` or
  `settings`), so any copy can close or replace it.
- `whistle-ui.seen`: the `seq` of the last event a copy handled, so a new copy flashes each
  event once.

`mods/whistle-ui/` is a reference: `ui.js` is the pure core the examples above test, `read.js`
copies `whistle.js`'s readers, and `main.js` is the shell that feeds it Herdr.

## Stable and may change

Stable: the props above, the corner block, and the `whistle-ui.settings` command. How the bar,
hints box and dialog look may change in any release.
