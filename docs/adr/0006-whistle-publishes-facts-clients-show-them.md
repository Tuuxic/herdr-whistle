# Whistle publishes facts; clients show them

If whistle decided the text, timing and geometry of what it shows, its bar couldn't be replaced,
and every copy drawing a bar would run whistle only to draw. We decided that whistle publishes facts and takes
commands, and **clients**, mods such as whistle-ui, decide what to show and how. Whistle draws
nothing: no bar, no hints box, no dialog, no flash text with a lifetime, no problem marker, no
docking. It publishes four public keys and takes the settings commands, which write whistle.json
for a client:

- `shared("whistle")`, the whistle state: mode, sequence, selected pane and field, why it is
  inert;
- `whistle.hints`: the hint items, the group a key sequence reached or the selected field's
  declared keys;
- `whistle.events`: a feed of what just happened (a mode switch, an unmapped key, a failed
  command, a new conflict), each with a kind, its groups, its data and a default text;
- `whistle.config`: config problems, conflicts, overrides and mods on or off.

Each public key carries its own `v`, which goes up only on a breaking change; new optional
fields come under the same `v`, and readers ignore fields they don't know. Every other
`whistle.*` key is private and may change in any release, unless the docs declare it public
(`whistle.mappings`, which mods write: [ADR 0011](0011-mods-offer-mappings-under-the-layout.md)).
Each private use gets a key of its own, so copies never overwrite each other.

## Considered options

- The anchor computing presentation in a presenter module: whistle would still know bars and
  overlays.
- Clients deriving everything from the whistle state: each would re-run whistle's config and
  keymap.
- One public key for everything: the state changes on every key, the config rarely, and any
  `setShared` re-renders every mod.
- A key per fact, each with its own version: more contract surface.
- One shared private object: copies writing different parts of it would race.

## Consequences

- Hiding every bar costs nothing: whistle runs in the anchor
  ([ADR 0005](0005-whistle-runs-in-its-block-the-anchor.md)), and whistle-ui's 0 px corner
  block shows the hints at the window's bottom right.
- Which bar shows is the layout's business, and Herdr remembers it. Whistle never shows or hides
  a client's block; whistle-ui docks the hints box on its first shown bar, or in the corner with
  none.
- Herdr has no per-key subscription: any `setShared` re-renders every mod. Whistle writes each
  public key only when it changes, and the event feed carries a rising `seq` so a client shows
  each event once.
- Whistle never names a client, except a mod that subscribes to events
  ([ADR 0018](0018-subscribers-get-events-pushed-while-they-show.md)). `whistle-ui.settings`
  opens whistle-ui's dialog; whistle has no settings command of its own.
- The inert notification isn't remembered per folder: a new copy skips it when the published
  whistle state already gives the same reason. A copy standing aside for another copy publishes
  no state, so after a layout change it may post its notification again.
