# Mods offer mappings through shared(), under the layout and add-only

Mods can give whistle mappings at runtime. A mod writes its own entry in
`shared("whistle.mappings")` (`{ [mod]: { v: 1, map } }`), keyed by its name so whistle always
knows a mapping's source, and whistle names no mod
([ADR 0013](0013-keynav-fields-join-by-protocol.md)).

Mod mappings are a config layer between the defaults and the layout: defaults < mods < layout <
whistle.json. A mod's offer is general, while a layout author who places the mod knows the
context, so the layout and the person can change or remove a mod's keys; a mod can't do the
same to anyone else. An entry uses `map`'s format, but it can only add keys (no null) and holds
mappings and groups only, never own keys or settings.

## Considered options

- A `whistle.register` command: it only reaches whistle while whistle's block shows, so mods
  would have to retry.
- A folder of files: whistle would have to watch it, and a mod can't easily take one back.

## Consequences

- An entry counts only while its mod has a block in the shown layout. Entries left behind in
  `shared()` are ignored, not cleared.
- Chords from mods are claimed in keys.json like any mapping
  ([ADR 0009](0009-whistle-claims-keys-in-keys-json.md)), so a layout switch can rewrite
  whistle's entries there.
- The person or a layout can switch off a mod's whole entry (`whistle.mappings-off:<mod>`, or
  `mods` in whistle.json). `whistle.config` names the source of each mapping, so a client's
  settings can show it; the hints don't.
