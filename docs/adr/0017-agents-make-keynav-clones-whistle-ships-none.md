# Agents make keynav clones; whistle ships none

Herdr's own spaces, tabs, agents, files and changes mods take no part in keynav, so in a stock
layout they are at best stock fields (no cursor, moving opens) and files and changes are no
fields at all. We decided that whistle ships no keynav forks, but RECIPE has an Integrate
section: after Install, or when asked, the agent offers an integration that makes the blocks of
the person's shown layout into keynav fields. Herdr's own mods and layouts are read-only, so the
agent clones them (`<name>-whistle`), adds keynav and a look for the selected field to the
clones, and switches to the cloned layout; the person's own mods are changed in place. Each
clone is made on the person's machine, with their consent, from the Herdr they run, so it fits
that Herdr; a record file, `whistle-integration.md` in Herdr's home, lets Update find clones
behind their original and offer to make them again, so they don't drift.

## Considered options

- Keynav forks shipped with whistle: a fork only works in a layout that points at it, and it
  drifts from Herdr's updates
  ([ADR 0016](0016-defaults-drive-stock-blocks-with-herdr-commands.md)).
- Changing Herdr's own mods in place: not possible, since Herdr replaces them on every start
  and moves an edited one aside.
- Asking Herdr's maintainers to add keynav to the stock mods: it changes Herdr itself, and it
  would not reach third-party mods.
- No integration, stock fields only: files and changes stay unreachable and no stock field
  shows a cursor.

## Consequences

- Two paths. Simple asks one thing: Herdr's blocks only (`spaces`, `agents`, `tabs`, `files`,
  `changes`, by id, whatever mod sits there) or all blocks; it clones third-party mods, uses
  whistle's suggested look and declares keys only for actions the mod already has. Advanced
  lets the person choose the layouts, the blocks, the look, the declared keys, and clone or in
  place for each third-party mod.
- Clones never get their original's updates on their own; Update compares each clone's
  `cloned_from.version` with its original and offers to make it again, and offers to add keynav
  again to an in-place mod whose author's update removed it.
- Uninstall offers to undo the integration from the record: the original layout back, the
  clones deleted, in-place changes removed. A keynav mod works the same without whistle, so
  keeping them does no harm beyond missing updates.
- Whistle's code never reads the record or names a clone; stock fields stay for anyone who
  doesn't integrate, and a keynav clone wins over the stock field table as any keynav mod does.
