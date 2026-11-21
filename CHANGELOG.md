# Changelog

Whistle's releases, newest first ([Keep a Changelog](https://keepachangelog.com), semver over
every public surface: ADR 0012). Agents relay these entries when they update whistle
(RECIPE.md, Update), and follow each entry's **Upgrading** note.

## v2.0.0 (unreleased)

### Upgrading

1. **Renamed commands (breaking)**: `whistle.whistle` is now `whistle.switch-mode`, and
   `whistle.type` is now `whistle.mode:type`. The old names are gone: whistle treats them as
   unknown commands, lists each keys.json line that still names one as a config problem, and
   does nothing when one runs. In the person's keys.json, replace `whistle.whistle` with
   `whistle.switch-mode` (in `global`, by default on `ctrl-space`) and `whistle.type` with
   `whistle.mode:type` (in `mod:whistle`, by default on `ctrl-space`), keeping their keys. Do
   the same in any mapping (whistle.json, a layout's whistle block) that runs them.
2. **Keynav v3 only (breaking)**: whistle drives keynav v3 fields only. A mod whose
   `keynav.js` is on v2 or v1 is no longer a field, and settings no longer ask it to update.
   For each such mod in `whistle-integration.md`, replace its `keynav.js` with whistle's and
   change its `open` move to `pick` (Integrate's "How a mod becomes a field").
3. **`open` is no longer read as `pick` (breaking)**: a `keys` section that sets `open` now
   sets an unknown action, listed as a config problem. In whistle.json and in a layout's
   whistle block, rename `open` to `pick`.
4. whistle.json's `bar` is no longer listed as a config problem: whistle ignores it, like any
   key it doesn't know. Nothing to do; you may remove it.
5. **Whistle draws nothing (breaking)**: whistle's bar, hints box and settings dialog are gone
   from whistle; whistle-ui draws them. Copy `mods/whistle-ui/` and merge its `keys.json` as
   Install steps 4 and 5 say. In each of the person's layouts with whistle blocks, keep exactly
   one whistle block, sized 0 px, with the layout's `mappings`, `keys`, `mods`, `enabled` and
   `nav` props; replace the other whistle blocks (the bars) with whistle-ui's bar, give it the
   old bar's `hintsAlignRight`, `hintsAlignBorder` and `hintsGap`, and add whistle-ui's corner
   block, as Install step 7 shows. Two whistle blocks with the same props make whistle stand
   aside, so never leave two.
6. **Props whistle doesn't take (breaking)**: on a whistle block, `anchor`, `bar`, `hints`,
   `hintsAlignRight`, `hintsAlignBorder` and `hintsGap` are props whistle doesn't know, each
   listed as a config problem. Remove them from the whistle block (the `hints*` props go on
   whistle-ui's bar). whistle.json's `hints` is ignored; remove it, and put `"hints": false` on
   whistle-ui's blocks if the person had the hints off.
7. **`whistle.settings` (breaking)**: whistle opens no dialog. Replace keys.json's
   `"alt-,": "whistle.settings"` (in `global`) with whistle-ui's `"alt-,": "whistle-ui.settings"`,
   keeping its key.

### You

- **Changed**: whistle draws nothing itself. whistle-ui (below) draws the bar, the hints box and
  the settings, and you can hide its bar with whistle working the same. Alt+, runs
  `whistle-ui.settings`.
- **Removed**: whistle.json's `hints`. Turn the hints box off with `"hints": false` on
  whistle-ui's blocks instead.
- **Changed**: the switch key's command is `whistle.switch-mode`, and the key that leaves
  WHISTLE runs `whistle.mode:type` (see Upgrading). The keys stay the same.
- **New**: `whistle.mode:whistle` goes to WHISTLE (and stays there), for a key that should only
  ever enter it.
- **New**: whistle-ui, a separate mod shipped with whistle: whistle's bar, hints box and
  settings dialog, drawn from what whistle publishes. Its bar shows the mode, where the keyboard
  is, a `⚠ n` count of config problems, "Whistle off", why whistle stands aside, and a 2 s flash
  for each event. Its hints box docks on the first bar that shows, or sits at the window's bottom
  right with no bar shown. `alt-,` runs `whistle-ui.settings`, which goes back to TYPE and opens
  its settings dialog ([whistle-ui.md](docs/contracts/whistle-ui.md)).
- **Changed**: `open` in your whistle.json's `keys` is no longer read as `pick`; it's an
  unknown action, listed in settings. Rename it to `pick`.
- **Changed**: whistle.json's `bar` is no longer listed in settings; whistle ignores it.
- **Changed**: a mod still on keynav v2 or v1 is no longer a field, and settings no longer
  mention it.

### Layout authors

- **Breaking**: every whistle block is the anchor, the block whistle runs in (0 px, drawing
  nothing), and its props are `mappings`, `keys`, `mods`, `enabled` and `nav`. The `anchor`
  prop, the bar block, `bar` spots, `hints` and the `hints*` place props are gone from whistle's
  block: each is listed as a prop whistle doesn't know. The first whistle block in layout order
  runs; another is listed as a config problem and acts on nothing; blocks with the same props
  make whistle stand aside, with one notification saying to keep one. A layout without a
  whistle block runs no whistle: no bar stands in for the anchor, and nothing rests
  ([layout-block.md](docs/contracts/layout-block.md)).
- **Changed**: a mapping that runs `whistle.whistle` or `whistle.type` is a config problem; run
  `whistle.switch-mode` or `whistle.mode:type` instead.
- **New**: whistle-ui's blocks: bars, and a 0 px corner block (`corner: true`) that shows the
  hints box when no bar shows. Props `hints`, `hintsAlignRight`, `hintsAlignBorder` and
  `hintsGap` ([whistle-ui.md](docs/contracts/whistle-ui.md#blocks-and-props)).
- **Changed**: `open` in the whistle block's `keys` is an unknown action; use `pick`.

### Mod authors

- **Breaking**: commands are spelled `whistle.<command>[:<argument>]`, with at most one argument
  whose kind each command declares (none, plain, or JSON where it needs several values).
  `whistle.whistle` became `whistle.switch-mode` and `whistle.type` became `whistle.mode:type`;
  `whistle.mode:whistle` is new. A command whistle doesn't know, or one with the wrong argument,
  raises a `command-failed` event ([commands.md](docs/contracts/commands.md#spelling)). From
  Windows PowerShell 5.1, pass a JSON argument with `herdr-app do --% "…"`.
- **New**: three public keys, each with its contract page and `whistle.js` reader:
  `whistle.hints`, the hint items whether or not a client shows them
  ([hints.md](docs/contracts/hints.md), `readHints()`); `whistle.events`, the last 8 events,
  each with a stable kind, its data and a default English text, numbered by `seq`
  ([events.md](docs/contracts/events.md), `readEvents(last)`); `whistle.config`, what the
  settings show ([config.md](docs/contracts/config.md), `readConfig()`). Only the running copy
  writes them, and only when they change.
- **New**: the whistle state's fields `field`, the selected field's block id in WHISTLE (else
  `null`), and `inert`, `{ problem, fix }` while whistle stands aside (else `null`). A copy
  standing aside on an old Herdr, or with whistle blocks that share their props, with no other
  copy running, writes the state with `inert` ([state.md](docs/contracts/state.md), rules 7 and
  8). `readState` gives both.
- **Breaking**: `whistle.settings` is gone: whistle opens no dialog, and runs it as an unknown
  command. whistle-ui's `whistle-ui.settings` opens its own.
- **New**: the settings commands, `whistle.mappings-on:<mod>`, `whistle.mappings-off:<mod>` and
  `whistle.keep-mapping:{"mod":"<mod>","keys":[…]}`: whistle writes whistle.json itself
  ([commands.md](docs/contracts/commands.md#settings-commands)).
- **New**: whistle-ui (`mods/whistle-ui/`) is a reference client: it uses only the public keys
  and commands, and any part of it can be replaced ([whistle-ui.md](docs/contracts/whistle-ui.md#replacing-a-part)).
- Whistle's private view keys are gone with its views: `whistle.bar:<folder>`,
  `whistle.told:<folder>`, `whistle.barsize:<folder>:<bar>`, `whistle.overlay:<folder>:<name>`
  and the hints and settings view models. `whistle.hints` is the public key above.

### Keynav authors

- **Breaking**: whistle drives keynav v3 only. An entry in v2 is no longer a field: whistle no
  longer sends it `<mod>.keynav-open` or reads v2's `{ to }` and `{ hold }` requests, and
  settings no longer ask it to update. A v1 copy is no longer named in settings either. Copy
  whistle's current `keynav.js` (v3). The keynav checker no longer has the `no v1` rule.

## v1.3.0 (2026-11-21)

### Upgrading

1. **whistle.json's `bar`**: if the person's whistle.json sets `bar`, show that spot and hide
   the layout's other spots once, by the whistle block whose `bar` prop matches
   (`herdr-app do layout.show '{"id":"<block id>"}'`, and `layout.hide` for the others), so
   the bar stays where it was. Then offer to remove `bar` from whistle.json, by its result:
   "whistle no longer picks the bar's spot; Herdr remembers which bar you show". Whistle never
   rewrites whistle.json itself.

### You

- **Changed**: whistle no longer shows or hides bars. Hide or show any bar and it stays that
  way (Herdr remembers it across restarts), even with `bar` set in your whistle.json.
- **Changed**: with no bar shown, the hints box sits at the window's bottom right, 480 px wide
  (narrower in a narrow window), no longer where a hidden bar would sit.
- **Removed**: whistle.json's `bar`. It is ignored and listed in settings as a config
  problem; remove it, and show the bar you want in the layout instead.

### Layout authors

- **Changed**: whistle never shows or hides spots, so a layout's own control (`layout.show` /
  `layout.hide` on a spot's block) is the way to switch spots; Herdr remembers which shows
  (docs/contracts/layout-block.md, rule 5). The `bar` prop still names each spot.
- **Changed**: with no bar shown, the hints box docks at the window's bottom right; a hidden
  spot's `hints*` props and last size no longer count (rule 13). In a window narrower than
  492 px, the box is the window's width less 12 px, 6 px in from each side (it was the
  window's full width), in a layout with no spot too.
- **Removed**: rule 11 (whistle.json's `bar` picking the spot from the anchor).

### Mod authors

- Nothing changes for you.

### Keynav authors

- Nothing changes for you.

## v1.2.0 (2026-11-21)

### Upgrading

1. **The anchor**: for each of the person's layouts that has whistle's bar but no whistle
   block with `anchor: true`, offer to add the anchor (RECIPE.md, Install step 7), by its
   result: "the bar becomes optional: you can hide it and whistle keeps working". Yes: add it
   just before the bar, as Integrate does, and move the bar's `mappings`, `keys`, `mods`,
   `enabled`, `hints` and `nav` to the anchor (each from the first whistle block that has it),
   taking them off every bar, so whistle works exactly as before. Herdr's own layouts are
   never edited.

### You

- **New**: Install and Integrate put an anchor into your layout next to the bar: an invisible
  block whistle runs in, so the bar is only an aid and can be hidden. Uninstall takes the
  anchor out again.
- **New**: in a layout with an anchor, the bar is optional. Hide every bar and whistle works
  the same: Ctrl+Space enters WHISTLE, mappings run, Ctrl+H/J/K/L select fields, jump keys
  work, and the whistle state is still published. Hiding the bar in WHISTLE keeps the mode,
  the selected field and the key sequence; a bar shown again shows the current state.
  whistle.json's `bar` still picks which spot shows. Layouts without an anchor work as before:
  hiding their bar rests whistle.
- **New**: when whistle stands aside (inert: Herdr too old, or another copy runs), one Herdr
  notification says why, so you learn it with the bar hidden too. It comes again only if the
  reason changes; the bar still says why as well (docs/guide.md, When whistle stands aside).
- **New**: with every bar hidden, the hints box still opens inside a group, docked where the
  picked bar spot would sit (at the size that spot had when it last showed), or at the
  window's bottom right in a layout with no bar spot. With a bar shown, the box docks on it
  in a layout with an anchor too.

### Layout authors

- **New**: the whistle block prop `anchor: true` marks the anchor, the block whistle runs in;
  size it 0 px and never hide it (docs/contracts/layout-block.md, The anchor). In a layout with
  an anchor, a bar's copy only draws: it acts on no command or key. The rule that a hidden
  spot's copy rests now holds only for layouts without an anchor.
- **New**: a layout with more than one anchor keeps working: the first in layout order runs
  whistle, and each other anchor is left out and listed as a config problem in settings.
  Anchors with the same props can't tell which comes first, so all of them are left out, a
  bar stands in, and settings list them; keep one.
- **Changed**: in a layout with an anchor, the layout's config layer (`mappings`, `keys`,
  `mods`, `enabled`, `hints`, `nav`) is read from the anchor alone; on a bar these props are
  skipped and listed as a config problem. Bars keep `bar` and the hints' place props
  (`hintsAlignRight`, `hintsAlignBorder`, `hintsGap`), which on the anchor are skipped and
  listed. Layouts without an anchor read them all from the bar, as before
  (docs/contracts/layout-block.md, rule 14).

### Mod authors

- The whistle state (docs/contracts/state.md) is published whether or not a bar shows: in a
  layout with an anchor, the anchor publishes it, so whistle-aware behaviour no longer depends
  on the bar. Nothing in the state's shape changes.

### Keynav authors

- Whistle drives your field the same with every bar hidden: in a layout with an anchor, the
  anchor sends the requests and selects fields. Nothing in the keynav contract changes.

## v1.1.0 (2026-11-20)

### Upgrading

1. **whistle.json**: if its `keys` section sets `"back"`, tell the person whistle has no back
   key any more (the setting is ignored and listed as a config problem), and offer to remove
   the line. If it sets `"open"`, offer to rename it to `"pick"`; whistle reads `open` as
   `pick` meanwhile and lists it in settings. Make no other change.
2. **Keynav v2 mods**: whistle still drives them. For each clone or in-place mod in
   `whistle-integration.md` whose `keynav.js` has `V = 2`, offer to adapt it to keynav v3
   (RECIPE.md, Integrate: replace its `keynav.js`, and its `open` move becomes `pick`). For a
   third-party mod with its own `keynav.js`, tell the person its author can update it.
3. **Pick and Show**: for the spaces and agents clones in `whistle-integration.md`, offer to
   make Enter go there and switch to TYPE, and Space show the item while staying in WHISTLE
   (RECIPE.md, Integrate, Pick and Show). Record them in the mod rows' declared keys.

### You

- **Changed**: whistle's own key `open` is now `pick` (Enter by default; on the terminal it
  still goes back to TYPE there), and the hints say Pick. A whistle.json that still sets
  `"open"` keeps working, and settings ask you to rename it; if it sets both, `"pick"` wins.
- **Removed**: the own key `back`. A key sequence has no step back any more: Escape ends it and
  you start again. A config layer that still sets `"back"` is ignored and listed as a config
  problem in whistle's settings.
- **Changed**: Backspace is an ordinary key. Map it in `whistle.json`, and a keynav field may
  declare it (a tree's "up a folder"); while such a field is selected, its key goes over your
  mapping, as for any declared key.
- **Fixed**: Shift+Space is its own key, `shift-space`, which you can map. Before, it did what
  Space does.
- **New**: unbinding an own key frees it. Set any own key to `null` or `[]` in whistle.json
  (the switch key still leaves WHISTLE); the freed key then belongs to a selected keynav field
  that declares it, or to your mapping where none does. With `pick` unbound, a field that
  declares `enter` gets Enter (docs/guide.md, Unbinding an own key).
- A field that declares one of whistle's own keys is still a config problem, which now names
  the own key and says the field's key counts once you unbind it.
- **New**: integrated spaces and agents lists (RECIPE.md, Integrate) pick into TYPE: Enter
  goes to the space or agent and you type there. Space shows the item while you stay in
  WHISTLE with the list selected.

### Layout authors

- The whistle block's `keys` prop names `pick` where it named `open`; `open` is still read,
  as in whistle.json, and listed as a config problem.

### Mod authors

- A mod that wants a pick in its keynav field to land in TYPE runs `whistle.type` after
  picking (docs/contracts/commands.md); it does nothing in TYPE, so no check of the mode is
  needed.

### Keynav authors

- **New**: keynav v3 (docs/contracts/keynav.md). The move open is now **pick**
  (`<mod>.keynav-pick`), and requests take one shape, `{ after: "terminal" | "hold", at }`, in
  place of `{ to: "terminal", at }` and `{ hold: true, at }`; the driver's entry says `v: 3`.
  Copy the new `mods/whistle/keynav.js`: its functions keep their names, `move` reads `pick`,
  and `toTerminal` and `keepKeys` write the new shape. Moves carry only what every field
  shares; anything one field does goes in its declared keys, and a field whose pick should
  land in TYPE runs `whistle.type` itself (ADR 0017).
- Whistle still drives v2 fields as before (`keynav-open`, `{ to }` and `{ hold }`), and its
  settings ask them to update their `keynav.js`. v1 stays unsupported.
- The keynav checker checks keynav v3, and names the rule a copy breaks that still reads
  `open` or writes v2's requests.
- **Changed**: a field may declare Backspace. It is no longer one of whistle's own keys, so
  declaring it is no longer a config problem.
- Rule 5: a declared key that is one of whistle's own keys counts once the person unbinds that
  own key; until then it is a config problem naming the own key (docs/contracts/keynav.md).
- **Fixed**: a field that declares `shift-space` gets it. Whistle named Shift+Space `space`, so
  the declared key never ran and Shift+Space did what Space does.

## v1.0.0 (2026-11-15)

### Upgrading

From a whistle older than 1.0 (a copy without `mods/whistle/version.js`):

1. **Copies**: find every whistle copy (each `mods/*/mod.json` with `"title": "Whistle"`) and
   update `mods/whistle/` in place. If the only copy is in another folder, move it to
   `mods/whistle/`. Ask before deleting the other copies; left there, they stand aside
   (inert) and say which copy runs.
2. **keys.json**: if the `terminal` section still binds `ctrl-[` to `whistle.enter`, ask the
   person whether to rebind it to `whistle.whistle` (Ctrl+[ then enters WHISTLE from a
   terminal, as an opt-in) or remove it, so Ctrl+[ reaches terminal programs again. Then offer
   the new jump keys, `"alt-a": "whistle.focus:agents"` and `"alt-s": "whistle.focus:spaces"`
   in the `global` section (`ctrl-shift-a` / `ctrl-shift-s` on macOS, where Option+letter types
   characters), and the settings key, `"alt-,": "whistle.settings"` (`ctrl-shift-,` on
   macOS), and add them if the person agrees. A copy that stays in another folder gets them as
   `<folder>.*`. Make no other change to keys.json.
3. **keynav v1 mods**: find mods under `mods/` that announce themselves in
   `shared("keynav.fields")` with `v: 1` (usually through a copied `keynav.js`). Tell the
   person they are no longer fields in whistle 1.0, and offer to fetch each one again from
   herdr.dev. Never edit a mod's code.
4. **whistle.json**: leave it alone. Its shape is unchanged.
5. **Keys**: tell the person what moved in the default map: Spaces from `S` to `s`, the
   Ctrl+[ switch key dropped (Ctrl+Space is the switch key, Ctrl+Shift+Space the documented
   fallback), and new defaults added.

### You

- **New**: jump keys. A `keys.json` line `whistle.<verb>:<block>` runs a verb (`field`, `focus`,
  `toggle`, `toggle-keep-mode`) on a layout block from either mode and goes to WHISTLE, so one
  key takes you to a field: Alt+A to the agents, Alt+S to the spaces (docs/guide.md, Jump keys).
  Mappings accept `toggle-keep-mode` too, and run it as `toggle`.
- **New**: integration. After installing whistle, or whenever you ask, the agent offers to make
  your layout's blocks into keynav fields (RECIPE.md, Integrate): Herdr's spaces, agents, tabs,
  files and changes get a cursor that moves without opening, a glow in the theme's `accent`
  while selected, and `n`/`r`/`x` on spaces and tabs. Herdr's own mods and layouts are
  cloned (`spaces-whistle`, `main-whistle`); yours are changed in place. A record,
  `whistle-integration.md` in Herdr's home, lets Update offer to make the clones again when
  Herdr updates their originals, and Uninstall offer to undo it all. Whistle itself ships no
  clones and never reads the record. Integrated lists keep the cursor in view as it moves, and
  a copy of the layout's pane header marks the terminal whistle has selected while in WHISTLE.
- **New**: on Herdr's own layouts (such as `main`), where Herdr never shows a new mod's bar,
  the installing agent asks, then makes a copy of the layout with the bar (`main-whistle`, the
  same copy integration uses) and switches to it. Agents now talk to you in the words you see
  in the window, and ask only what is yours to choose (RECIPE.md, Talking to the person).
- **New**: Herdr's spaces, tabs and agents lists are fields without integration: whistle drives
  them with Herdr's own commands (`j`/`k` shows the next space or agent), and the bar names the
  one selected (docs/guide.md, Fields).
- **New**: the default map, grouped by noun: `s` spaces, `t` tabs, `w` panes, `a` agents, with
  terminal scrolling and find (`ctrl-u`, `ctrl-d`, `g`, `G`, `f`). A mapping that makes or opens
  something you type into (a new tab, a split) ends in TYPE with the keyboard there
  (docs/guide.md, The default map).
- **Breaking**: Ctrl+Space is the only shipped switch key; Ctrl+[ no longer enters WHISTLE
  unless you bind it (docs/guide.md, Modes and the switch key).
- Switched off, the bar says "Whistle off" and keeps the config-problem marker.
- Whistle stands aside (inert) on a Herdr older than it needs, or while another copy of
  whistle runs: it claims nothing, Ctrl+Space types through, and the bar says why.
- Whistle claims the keys it needs in keys.json's `mod:whistle` section itself. It reads keys
  in any spelling Herdr accepts (`cmd-k`, `win-k`, `secondary-k`, `shift-ctrl-x`, `Ctrl-X`),
  so your own entry for a key wins however you spelled it, and it puts the old text back if
  Herdr rejects what it wrote.
- Your config comes in layers: whistle's defaults, then the layout's whistle block, then your
  `whistle.json`, each over the one before. Mappings (`map`) and whistle's own keys (`keys`)
  stay apart, and a key or action set to `null` is taken away (docs/guide.md, Your config).
- Something wrong in your config no longer stops whistle: a file that doesn't parse runs on
  its last good version, a bad entry is skipped, settings list every config problem and the
  bar shows a marker while there are any. A command Herdr refuses shows Herdr's own error
  message, and whistle stays in its mode.
  keys.json isn't written while a file is broken, and whistle's claims come back by themselves
  once it's fixed.
- Settings list config problems, mapping conflicts between mods (with "Keep <mod>'s") and the
  keys you or the layout map over mods', and switch a mod's mappings off; each change is
  written into your whistle.json (docs/guide.md, Settings), which is written again whole with
  2-space indents (your entries and their order stay, your own line breaks don't). The hints
  name the key that cancels a sequence.
- **New**: Alt+, (Ctrl+Shift+, on macOS) opens whistle's settings from anywhere: in TYPE, in WHISTLE and while
  whistle is switched off (Ctrl+, stays Herdr's settings).
- A copy of whistle in another folder (`mods/whistle-2/`) answers only to `whistle-2.*` in
  keys.json, and types those keys through while switched off or inert; its settings list a config
  problem while no `global` line runs its own switch command and one runs another folder's
  (docs/guide.md, A copy in another folder). Install writes such a copy's keys
  with its folder's name, and Update rewrites them to `whistle.*` when it moves the copy back.

### Layout authors

- The layout's whistle block (docs/contracts/layout-block.md) is a stable contract: `mappings`,
  `keys`, `mods`, `enabled`, `hints`, `nav`, `bar`, and `hintsAlignRight`, `hintsAlignBorder`
  and `hintsGap`, which line the hints box up with a bar set in from the window's edge. `nav`
  directions are `left`/`down`/`up`/`right`, and a bad prop is listed as a config problem.
- **Breaking**: `hintsAlignRight` is the px from the window's right edge to the bar block's
  outer edge, its border included (it was to the bar's inside: a bar set in 200 px with a 2 px
  border needed 202, now 200), and `hintsGap` counts from the block's top border (the border
  used to eat into the gap). A layout that set `hintsAlignRight` with a border takes
  `hintsAlignBorder` off it.

### Mod authors

- docs/authors.md routes you to the contract for your job and the helpers to copy.
- **Breaking**: whistle's commands are a stable set (docs/contracts/commands.md):
  `whistle.whistle`, `whistle.type`, `whistle.on`, `whistle.off`, `whistle.settings` and the
  verbs `whistle.field|focus|toggle|toggle-keep-mode:<block>`. `whistle.enter`, `whistle.focus`
  without a block and the direction commands are gone; `whistle.key-<key>` is only how whistle
  claims keys, not for binding.
- **Breaking**: whistle's state is one public key, `shared("whistle") = { v: 1, mode, enabled,
  sequence, pane }` (docs/contracts/state.md), read with a copied `mods/whistle/whistle.js`.
  `whistle.enabled` and `whistle.sequence` are gone; other `whistle.*` keys are private.
- **New**: `offerMappings(mod, map)` in the copied `whistle.js` offers your mod's mappings and
  groups in `shared("whistle.mappings")` (docs/contracts/mod-mappings.md); they count while your
  mod is in the shown layout.
- **New**: whistle state's `onTerminal`, `true` while in WHISTLE with the terminal the selected
  field, `false` otherwise (TYPE, switched off, a keynav or stock field selected). Keynav's
  `active` is `null` for both the terminal and a stock field, so read `onTerminal` to mark the
  selected terminal: `mode === "whistle" && onTerminal && pane === <your pane>`. The terminal
  is whistle's own field, never a keynav field (ADR 0016). `readWhistle()` gives it.

### Keynav authors

- **Breaking**: keynav v2 (docs/contracts/keynav.md). Each field writes its own entry,
  `shared("keynav.field:<field key>") = { v: 2, label, keys }`, and its own request slot,
  `shared("keynav.request:<field key>")`; `shared("keynav")` is `{ v: 2, active }`. A field
  declares the keys it handles (`keys: { d: "Delete" }`), which arrive as
  `<mod>.keynav-key-<key>`, beat whistle's mappings but never its own keys; other keys never
  reach it. Copy the new `mods/whistle/keynav.js`; a copy still on v1 isn't a field.
- **New**: the keynav checker in `kit/keynav-checker/`. Run `bash kit/keynav-checker/check.sh
  path/to/your-mod` to check your copy of `keynav.js` against keynav v2 with `herdr-app check`
  (docs/contracts/keynav.md, "Checking your field").
