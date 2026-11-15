# The terminal is whistle's own field; whistle state says when it is selected

Integration's header copy marks the selected terminal in WHISTLE, and it marked it even while
another field was selected: whistle state's `pane` is the terminal pane whistle has selected, and
it keeps that value while Spaces or Agents is selected, so that whistle can come back to it.
Nothing public said whether the terminal *is* the selected field. Keynav's `active` is `null`
both when the terminal is selected and when a stock field is.

The terminal isn't a keynav field, and it won't become one. Keynav (ADR 0002, ADR 0009) is the
agreement through which a *mod* becomes a field: the mod announces itself, draws its own cursor
and takes `<mod>.keynav-*` commands from the driver. A terminal pane is Herdr's own pane with a
program in it, not a mod. Nothing on its side can announce, draw a cursor or take keynav
commands. Whistle drives it itself with Herdr's pane commands (`pane.go`, `pane.focus`), the way
it drives stock fields with Herdr's commands (ADR 0006). So a field is one of three kinds: the
terminal and stock fields, which whistle drives itself, and keynav fields, which mods drive
through keynav.

We decided that whistle state says it: `shared("whistle")` gains `onTerminal`, `true` while
WHISTLE is on and the terminal is the selected field, `false` otherwise. It is a new field under
`v: 1` (ADR 0010's rule), so it isn't breaking.

Considered options:

- `"terminal"` as a value of keynav's `active`, as keynav v1 had it (`active: key | "terminal" |
  null`). Rejected: keynav is an agreement between fields and any driver, and the terminal is
  neither a field announced through it nor something every driver has. ADR 0009 took the value
  out for that reason; putting it back would make every keynav field reader handle a value that
  names no field.
- The terminal announcing itself as a keynav field, with whistle writing its entry. Rejected:
  whistle would play both sides of keynav, and a terminal can't take the commands a field must
  take.
- No new field: a reader checks that keynav's `active` is `null`. Rejected: that is also true
  while a stock field is selected, so a header would glow while Herdr's own spaces list is
  selected.

## Consequences

- ADR 0010 rejected repeating the selected field in whistle state. `onTerminal` doesn't: it says
  only whether the one field that keynav can't name is selected, so it never disagrees with
  `active` (a keynav field selected means `active` names it and `onTerminal` is `false`).
- A mod that marks the selected terminal (Integration's header copy) checks `mode` is
  `"whistle"`, `onTerminal` and `pane` together.
- The glossary's **Field** says the terminal is whistle's own; `docs/contracts/state.md` and
  `docs/contracts/keynav.md` link this ADR where they speak of the terminal.
