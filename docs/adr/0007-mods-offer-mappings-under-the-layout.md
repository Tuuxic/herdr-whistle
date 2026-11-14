# Mods offer mappings through shared(), under the layout and add-only

Mods can give whistle mappings at runtime. A mod writes its own entry in
`shared("whistle.mappings")` (`{ [mod]: { v: 1, map } }`), keyed by its name so whistle always
knows a mapping's source, and whistle names no mod (ADR 0002). Rejected: a `whistle.register`
command, which only reaches whistle while it is on screen, so mods would have to retry, and a
folder of files, which whistle would have to watch and which a mod can't easily take back.

Mod mappings are a config layer between the defaults and the layout: defaults < mods < layout <
whistle.json. A mod's offer is general, while a layout author who places the mod knows the
context, so the layout and the person can change or remove a mod's keys; a mod can't do the
same to anyone else. An entry uses `map`'s format, but it can only add keys (no null) and holds
mappings and groups only, never own keys or settings.

## Consequences

- An entry counts only while its mod has a block in the shown layout. Entries left behind in
  `shared()` are ignored, not cleared.
- Chords from mods are claimed in keys.json like any mapping (ADR 0001), so a layout switch
  can rewrite whistle's entries there.
- The person or a layout can switch off a mod's whole entry, and whistle's settings name the
  source of each mapping. The hints don't.
