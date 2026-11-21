# The terminal is whistle's own field; whistle state says when it is selected

The whistle state's `pane` is the terminal pane whistle has selected, and it keeps that value
while another field is selected, so that whistle can come back to it. Keynav's `active` is
`null` both when the terminal is selected and when a stock field is. So without more, a mod
that marks the selected terminal can't tell whether the terminal *is* the selected field.

The terminal isn't a keynav field, and it won't become one. Keynav
([ADR 0013](0013-keynav-fields-join-by-protocol.md)) is the agreement through which a *mod*
becomes a field: the mod announces itself, draws its own cursor and takes `<mod>.keynav-*`
commands from the driver. A terminal pane is Herdr's own pane with a program in it, not a mod.
Nothing on its side can announce, draw a cursor or take keynav commands. Whistle drives it
itself with Herdr's pane commands (`pane.go`, `pane.focus`), the way it drives stock fields with
Herdr's commands ([ADR 0016](0016-defaults-drive-stock-blocks-with-herdr-commands.md)). So a
field is one of three kinds: the terminal and stock fields, which whistle drives itself, and
keynav fields, which mods drive through keynav.

We decided that the whistle state says it: `onTerminal` is `true` while WHISTLE is on and the
terminal is the selected field, `false` otherwise.

## Considered options

- `"terminal"` as a value of keynav's `active`: keynav is an agreement between fields and any
  driver, and the terminal is neither a field announced through it nor something every driver
  has. Every keynav field reader would have to handle a value that names no field.
- The terminal announcing itself as a keynav field, with whistle writing its entry: whistle
  would play both sides of keynav, and a terminal can't take the commands a field must take.
- No new field, a reader checking that keynav's `active` is `null`: that is also true while a
  stock field is selected, so a header would glow while Herdr's own spaces list is selected.

## Consequences

- `onTerminal` says only whether the one field that keynav can't name is selected, so it never
  disagrees with `active` (a keynav field selected means `active` names it and `onTerminal` is
  `false`).
- A mod that marks the selected terminal checks `mode` is `"whistle"`, `onTerminal` and `pane`
  together.
