# Commands take one argument, after the first colon

Herdr hands a mod's command over as one string and never passes args, even from a `keys.json`
line, so a command and everything it acts on must fit in that string. We decided on
`whistle.<command>[:<argument>]`, as Herdr's own `name:value` commands are: at most one
argument, everything after the first colon, exactly as written. Each command declares what its
argument is:

- **none**: `whistle.switch-mode`, `whistle.on`;
- **plain**: the string as it is, never parsed: a block id (`whistle.focus:agents`), a mod name
  (`whistle.mappings-off:alpha`), a word (`whistle.mode:type`);
- **JSON**: one JSON value, only where a command needs several values
  (`whistle.keep-mapping:{"mod":"claude-hints","keys":["g","q"]}`).

Command names never contain a colon, so whistle reads up to the first colon for the command and
takes the rest as the argument, which may itself contain colons or any word. The one choice a
jump key can make, keeping the mode it was pressed in, is part of the verb's name:
`whistle.toggle-keep-mode:sidebar`.

## Considered options

- A mode word after a second colon (`whistle.toggle:sidebar:stay`): a block whose id is
  `test:stay` can't be told from block `test` keeping the mode.
- Deciding by the layout: if a block `test:stay` exists it is the id, else an override. The
  same key would mean different things in different layouts.
- An escape for colons in ids (`test\:stay`): hard to read, easy to get wrong in JSON.
- Several colon-separated arguments (`whistle.keep-mapping:<mod>:<keys>`): which colon splits
  depends on the command, and a mod name or key couldn't hold one.
- Parsing every argument as JSON: a block id or mod name would need quotes in keys.json.
- The object form of a `keys.json` action (`{ "command": ..., "args": ... }`): Herdr's docs
  give it for app commands only, and a mod's command arrives as a string.
- A block named by its mod rather than its id: a layout can show one mod twice.

## Consequences

- Only `toggle` takes `-keep-mode`: `field` and `focus` select a field, which needs WHISTLE.
  A mapping accepts `toggle-keep-mode` and runs it as `toggle`, so one spelling works in both
  places.
- A command whistle doesn't know, or a known one with the wrong argument (a word it doesn't
  take, JSON that doesn't parse or lacks a field), is a config problem on its keys.json line
  and a `command-failed` event when it runs.
- Windows PowerShell 5.1 strips the double quotes inside an argument it passes to a program, so
  a JSON argument needs `herdr-app do --% "…"` there. The commands contract says so.
- The spelling is public in people's `keys.json`; changing it is a breaking change.
