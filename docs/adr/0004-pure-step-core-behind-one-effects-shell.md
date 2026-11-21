# A pure step core behind one effects shell

Whistle's behaviour lives in one pure module, `step(model, input, world) -> { model, effects,
handled }`. `main.js` is a thin shell: it reads Herdr into `world` (layout, focused pane,
announced fields, offered mappings, file texts, `now`), calls `step` on each key press, command
and tick, carries out the effects and feeds write outcomes back as inputs. Effects are a closed
set of data: run a command, set shared state, write a file, focus the anchor, type a key into a
terminal. Behind the core sit internal modules (keynames, config, keymap, fields with a
terminal, keynav and stock adapter, claims, the published facts). whistle-ui is built the same
way: a pure `ui(published, world)` core behind its own shell.

The focus workarounds Herdr needs (holding the keyboard after a command, handing it to a
terminal after a `type` mapping, waiting for a just-shown field to announce itself) are
deadlines in the model, driven by `world.now`, so tests can step the clock through them.

## Considered options

- Feature modules that each call Herdr directly: effects spread out, and tests need Herdr fakes.
- Several pure modules orchestrated by the shell: the rules that combine them (mode changes,
  focus holds, falling back to the terminal) stay untested in the shell.
- An async core handed an io object.
- Timers kept in the shell.

## Consequences

- The core never awaits. Files are read by the shell and passed in `world`; writes are effects
  whose outcome comes back as an input, so a hand edit of whistle.json and a settings command's
  write are both picked up on the next read.
- Field adapters and own-key actions are internal seams, not extension points. A mod becomes a
  field only through keynav ([ADR 0013](0013-keynav-fields-join-by-protocol.md)).
