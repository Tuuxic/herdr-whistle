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
   terminal, as an opt-in) or remove it, so Ctrl+[ reaches terminal programs again. Make no
   other change to keys.json.
3. **keynav v1 mods**: find mods under `mods/` that announce themselves in
   `shared("keynav.fields")` with `v: 1` (usually through a copied `keynav.js`). Tell the
   person they are no longer fields in whistle 1.0, and offer to fetch each one again from
   herdr.dev. Never edit a mod's code.
4. **whistle.json**: leave it alone. Its shape is unchanged.
5. **Keys**: tell the person what moved in the default map: Spaces from `S` to `s`, the
   Ctrl+[ entry key dropped (Ctrl+Space is the switch key, Ctrl+Shift+Space the documented
   fallback), and new defaults added.

### You

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
