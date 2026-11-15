# Changelog

Whistle's releases, newest first ([Keep a Changelog](https://keepachangelog.com), semver over
every public surface: ADR 0012). Agents relay these entries when they update whistle
(RECIPE.md, Update), and follow each entry's **Upgrading** note.

## v1.0.0 (unreleased)

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
   characters), and add them if the person agrees. Make no other change to keys.json.
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
  clones and never reads the record.

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
  bar shows a marker while there are any. A command that fails when pressed only flashes.
  keys.json isn't written while a file is broken, and whistle's claims come back by themselves
  once it's fixed.
- Settings list config problems, mapping conflicts between mods (with "Keep <mod>'s") and the
  keys you or the layout map over mods', and switch a mod's mappings off; each change is
  written into your whistle.json (docs/guide.md, Settings). The hints name the key that
  cancels a sequence.

### Layout authors

- The layout's whistle block (docs/contracts/layout-block.md) is a stable contract: `mappings`,
  `keys`, `mods`, `enabled`, `hints`, `nav`, `bar`, and `hintsAlignRight`, `hintsAlignBorder`
  and `hintsGap`, which line the hints box up with a bar set in from the window's edge. `nav`
  directions are `left`/`down`/`up`/`right`, and a bad prop is listed as a config problem.

### Mod authors

- **Breaking**: whistle's state is one public key, `shared("whistle") = { v: 1, mode, enabled,
  sequence, pane }` (docs/contracts/state.md), read with a copied `mods/whistle/whistle.js`.
  `whistle.enabled` and `whistle.sequence` are gone; other `whistle.*` keys are private.
- **New**: `offerMappings(mod, map)` in the copied `whistle.js` offers your mod's mappings and
  groups in `shared("whistle.mappings")` (docs/contracts/mod-mappings.md); they count while your
  mod is in the shown layout.

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
