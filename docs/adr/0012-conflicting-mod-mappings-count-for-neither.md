# Conflicting mod mappings count for neither

Mod mappings share one config layer
([ADR 0011](0011-mods-offer-mappings-under-the-layout.md)), so two mods can offer the same key,
and a mod can offer one of whistle's own keys (j, Esc, a field key). We decided that a **mapping
conflict** counts for neither mod: the key falls through to the layers below, or is unmapped,
until the layout or the person maps it or switches a mod off. Own keys always win over mod
mappings.

Two groups on the same key aren't a conflict: they merge key by key, like groups across
layers, and only keys both offer inside them conflict. The group's title comes from the mod
that's first in layout order.

## Considered options

- The first mod in layout order wins, or the first alphabetically. Both are predictable but
  silent: a key would change meaning whenever someone edited the layout or installed a mod, and
  the person would never learn that two mods wanted it.

## Consequences

- `whistle.config` lists each conflict with its sources, and `whistle.keep-mapping` writes one
  mod's mapping into whistle.json to settle it. A new conflict raises a `conflict-new` event.
  The hints don't show conflicts.
- A layer above the mods mapping over a mod's key is not a conflict. `whistle.config` lists it
  as an override.
- A conflicting chord is claimed in keys.json
  ([ADR 0009](0009-whistle-claims-keys-in-keys-json.md)) only while a lower layer still maps
  it, so Herdr's own binding keeps working until the conflict is settled.
- Installing a mod can't break moving through fields, because own keys beat mod mappings. The
  layout and whistle.json can still map over own keys.
