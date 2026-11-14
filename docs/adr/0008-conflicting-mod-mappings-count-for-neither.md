# Conflicting mod mappings count for neither

Mod mappings share one config layer (ADR 0007), so two mods can offer the same key, and a mod
can offer one of whistle's own keys (j, Esc, a field key). We decided that a **mapping
conflict** counts for neither mod: the key falls through to the layers below, or is unmapped,
until the layout or the person maps it or switches a mod off. Own keys always win over mod
mappings. Rejected: the first mod in layout order wins, or the first alphabetically. Both are
predictable but silent. A key would change meaning whenever someone edited the layout or
installed a mod, and the person would never learn that two mods wanted it.

Two groups on the same key aren't a conflict: they merge key by key, like groups across
layers, and only clashing keys inside them conflict. The group's title comes from the mod
that's first in layout order.

## Consequences

- Whistle's settings mark each conflict with its sources and offer "keep <mod>'s", which
  writes that mapping into whistle.json. When a new conflict appears, the bar flashes once.
  The hints don't show conflicts.
- A layer above the mods mapping over a mod's key is not a conflict. Settings label it
  ("you, over <mod>"), with no flash.
- A conflicting chord is claimed in keys.json (ADR 0001) only while a lower layer still maps
  it, so Herdr's own binding keeps working until the conflict is resolved.
- Installing a mod can't break moving through fields, because own keys beat mod mappings. The
  layout and whistle.json can still map over own keys.
