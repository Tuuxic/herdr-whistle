# A pure step core behind one effects shell

Whistle's behaviour lives in one pure module, `step(model, input, world) -> { model, effects }`,
plus view-model functions for the bar, the hints and the settings dialog. `main.js` is a thin
shell: it reads Herdr into `world` (layout, focused pane, announced fields, offered mappings,
file texts, `now`), calls `step` on each key press, command, click-away and tick, carries out
the effects and feeds write outcomes back as inputs. Effects are a closed set of data: run a
command, set shared state, write a file, focus the bar, open or close an overlay, type a key
into a terminal. Behind the core sit internal modules (keynames, config, keymap, fields with a
terminal, keynav and stock adapter, claims), and the views only draw the models they are given.

The focus workarounds Herdr needs (holding the keyboard after a command, handing it to a
terminal after a `type` mapping, waiting for a just-shown field to announce itself) are
deadlines in the model, driven by `world.now`, so tests can step the clock through them.

Rejected: feature modules that each call Herdr directly, which spread effects out and need Herdr
fakes to test; several pure modules orchestrated by the shell, which leaves the rules that
combine them (mode changes, focus holds, falling back to the terminal) untested in the shell;
an async core handed an io object; and timers kept in the shell.

## Consequences

- The core never awaits. Files are read by the shell and passed in `world`; writes are effects
  whose outcome comes back as an input.
- Field adapters and own-key actions are internal seams, not extension points. A mod becomes a
  field only through keynav.
- The settings copy changes things by writing whistle.json through the config module; the bar
  picks the change up on its next poll, as for a hand edit.
- Each bar copy runs its own core; a hidden copy rests. Superseded by
  [ADR 0018](0018-whistle-runs-in-an-invisible-anchor-bars-are-views.md): the anchor runs
  whistle, and bars are views.
