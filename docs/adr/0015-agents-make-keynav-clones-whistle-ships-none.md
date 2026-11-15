# Agents make keynav clones; whistle ships none

Herdr's own spaces, tabs, agents, files and changes mods take no part in keynav, so in a stock
layout they are at best stock fields (no cursor, moving opens) and files and changes are no
fields at all. ADR 0006 rejected keynav forks shipped with whistle: a fork only works in a
layout that points at it, and it drifts from Herdr's updates. We decided that whistle still
ships no forks, but RECIPE gains an Integrate section: after Install, or when asked, the agent
offers an integration that makes the blocks of the person's shown layout into keynav fields.
Herdr's own mods and layouts are read-only, so the agent clones them (`<name>-whistle`), adds
keynav and a look for the selected field to the clones, and switches to the cloned layout; the
person's own mods are changed in place. Each clone is made on the person's machine, with their
consent, from the Herdr they run, which answers the first of ADR 0006's reasons; a record file,
`whistle-integration.md` in Herdr's home, lets Update find clones behind their original and
offer to make them again, which answers the second.

Considered options:

- Keynav forks shipped with whistle (ADR 0006). Still rejected, for ADR 0006's reasons.
- Changing Herdr's own mods in place. Not possible: Herdr replaces them on every start and moves
  an edited one aside.
- Asking Herdr's maintainers to add keynav to the stock mods. Out of scope for 1.0 (changing
  Herdr itself), and it would not reach third-party mods.
- No integration, stock fields only. Rejected: files and changes stay unreachable and no stock
  field shows a cursor or which block is selected.

## Consequences

- Two paths. Simple asks one thing: Herdr's blocks only (`spaces`, `agents`, `tabs`, `files`,
  `changes`, by id, whatever mod sits there) or all blocks; it clones third-party mods, uses
  whistle's suggested look (the selected field glows in `accent`, the cursor item gets an
  `accent` outline) and declares keys only for actions the mod already has. Advanced lets the
  person choose the layouts, the blocks, the look, the declared keys, and clone or in place for
  each third-party mod.
- Clones never get their original's updates on their own; Update compares each clone's
  `cloned_from.version` with its original and offers to make it again, and offers to add keynav
  again to an in-place mod whose author's update removed it.
- Uninstall offers to undo the integration from the record: the original layout back, the clones
  deleted, in-place changes removed. A keynav mod works the same without whistle, so keeping
  them does no harm beyond missing updates.
- Whistle's code never reads the record or names a clone; stock fields (ADR 0006) stay for anyone
  who doesn't integrate, and a keynav clone wins over the stock field table as any keynav mod does.
