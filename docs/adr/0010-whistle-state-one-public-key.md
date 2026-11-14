# Whistle's state for other mods: one public key, the rest private unless declared

Whistle wrote `shared("whistle.enabled")` for other mods' settings and `shared("whistle.sequence")`
for its own hints window, and neither was documented. The keynav driver state
`shared("keynav") = { v, active, pane }` (ADR 0009) also carried `pane`, which no field reads.
We decided that 1.0 publishes whistle's state as one versioned contract:

- `shared("whistle") = { v: 1, mode, enabled, sequence, pane }`, written only by whistle's main
  copy. `mode` is `"type"` or `"whistle"` (always `"type"` while `enabled` is false);
  `sequence` is `null` or `{ keys, group }`, with keys in whistle's canonical key names and
  `group` the resolved group's name (ADR 0008 settles which name wins); `pane` is the terminal
  pane whistle has selected.
- `v` follows keynav's rule: it goes up only on breaking changes, new optional fields come
  under the same `v`, and readers ignore fields they don't know.
- Keynav keeps only what fields need: `shared("keynav") = { v: 2, active }`, the "you are
  selected" signal any driver writes. `pane` moves to whistle's state, and whistle's state
  doesn't repeat `active`, so the two can't disagree.
- Every other `whistle.*` key is private and may change in any release, unless whistle's docs
  declare it public. Today the public ones are `whistle` and `whistle.mappings` (ADR 0007).
  Each private use gets a key of its own, so whistle's copies never overwrite each other.

Rejected: a key per fact, each with its own version (more contract surface); repeating the
selected field in whistle's state, or moving it there so keynav fields read a key named after
whistle; publishing the hint items, which would let a mod redraw the hints and get around the
rule that the hints' look isn't customizable; and one shared private object, which copies
writing different parts of would race on.

## Consequences

- `whistle.enabled` and `whistle.sequence` go away; the hints window reads a private key.
- A mod that wants to know about WHISTLE reads one key and never parses display text.
- Whatever is added later to the contract is declared in the docs; anything undeclared can be
  renamed or dropped without bumping `v`.
