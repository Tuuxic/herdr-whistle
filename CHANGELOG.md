# Changelog

Whistle's releases, newest first ([Keep a Changelog](https://keepachangelog.com), semver over
every public surface: ADR 0012). Agents relay these entries when they update whistle
(RECIPE.md, Update), and follow each entry's **Upgrading** note.

## v1.1.0 (unreleased)

### Upgrading

1. **whistle.json**: if its `keys` section sets `"back"`, tell the person whistle has no back
   key any more (the setting is ignored and listed as a config problem), and offer to remove
   the line. Make no other change.

### You

- **Removed**: the own key `back`. A key sequence has no step back any more: Escape ends it and
  you start again. A config layer that still sets `"back"` is ignored and listed as a config
  problem in whistle's settings.
- **Changed**: Backspace is an ordinary key. Map it in `whistle.json`, and a keynav field may
  declare it (a tree's "up a folder"); while such a field is selected, its key goes over your
  mapping, as for any declared key.

### Keynav authors

- **Changed**: a field may declare Backspace. It is no longer one of whistle's own keys, so
  declaring it is no longer a config problem.

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
