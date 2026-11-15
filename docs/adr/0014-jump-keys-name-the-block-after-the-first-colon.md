# Jump keys name the block after the first colon

A jump key is a line in Herdr's `keys.json`, such as `"alt-a": "whistle.focus:agents"`, and
Herdr hands a mod's command over as one string, with no arguments. So the verb, the block and
any choice about the mode must all fit in that string. We decided that everything after the
first colon is the block's id, exactly as written, and that the one choice a jump key can make,
keeping the mode it was pressed in, is part of the verb's name: `whistle.toggle-keep-mode:sidebar`.
Verb names never contain a colon, so whistle reads up to the first colon for the verb and takes
the rest as the id, which may itself contain colons or any word.

Considered options:

- A mode word after a second colon (`whistle.toggle:sidebar:stay`). Rejected: a block whose id
  is `test:stay` can't be told from block `test` keeping the mode.
- Deciding by the layout: if a block `test:stay` exists it is the id, else it is an override.
  Rejected: the same key would mean different things in different layouts.
- An escape for colons in ids (`test\:stay`). Rejected: hard to read, easy to get wrong in JSON.
- The object form of a `keys.json` action (`{ "command": ..., "args": ... }`). Not possible:
  Herdr's docs give it for app commands only, and a mod's command arrives as a string.
- The block named by its mod rather than its id. Rejected: a layout can show one mod twice, and
  mappings already name blocks by id (`whistle.field:<block>`).

## Consequences

- Only `toggle` takes `-keep-mode`: `field` and `focus` select a field, which needs WHISTLE, so
  `field-keep-mode` and `focus-keep-mode` are unknown commands. A mapping accepts
  `toggle-keep-mode` and runs it as `toggle`, so one spelling works in both places.
- Herdr passing the text after a colon to a mod unchanged was seen on 0.1.15 (it neither refused
  `whistle.whistle:probe` nor cut it to `whistle`), but not yet seen arriving in whistle.
- The spelling is public in people's `keys.json`; changing it later is a breaking change.
