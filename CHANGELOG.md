# Changelog

Whistle's releases, newest first ([Keep a Changelog](https://keepachangelog.com), semver over
every public surface: ADR 0012). Agents relay these entries when they update whistle
(RECIPE.md, Update), and follow each entry's **Upgrading** note.

## v1.2.0 (unreleased)

### You

- **New**: in a layout with an anchor, the bar is optional. Hide every bar and whistle works
  the same: Ctrl+Space enters WHISTLE, mappings run, Ctrl+H/J/K/L select fields, jump keys
  work, and the whistle state is still published. Hiding the bar in WHISTLE keeps the mode,
  the selected field and the key sequence; a bar shown again shows the current state.
  whistle.json's `bar` still picks which spot shows. Layouts without an anchor work as before:
  hiding their bar rests whistle.

### Layout authors

- **New**: the whistle block prop `anchor: true` marks the anchor, the block whistle runs in;
  size it 0 px and never hide it (docs/contracts/layout-block.md, The anchor). In a layout with
  an anchor, a bar's copy only draws: it acts on no command or key. The rule that a hidden
  spot's copy rests now holds only for layouts without an anchor.
- **New**: a layout with more than one anchor keeps working: the first in layout order runs
  whistle, and each other anchor stands aside and is listed as a config problem in settings.
- **Changed**: in a layout with an anchor, the layout's config layer (`mappings`, `keys`,
  `mods`, `enabled`, `hints`, `nav`) is read from the anchor alone; on a bar these props are
  skipped and listed as a config problem. Bars keep `bar` and the hints' place props
  (`hintsAlignRight`, `hintsAlignBorder`, `hintsGap`), which on the anchor are skipped and
  listed. Layouts without an anchor read them all from the bar, as before
  (docs/contracts/layout-block.md, rule 13).

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
