# Keynav moves carry only what every field shares

Behaviour such as Pick on a spaces or agents field landing in TYPE, or Space showing an item
without leaving WHISTLE, has to go somewhere. TYPE is whistle's mode, not keynav's, which knows
no modes, and every feature added to keynav would wait on a spec change. We decided to draw the
line in three:

- **Moves** (up, down, left, right, pick) are only what every kind of field shares, the
  terminal and stock fields included. The list grows only for something just as universal.
- **Declared keys** carry everything one field does: Space to show, d to delete.
- **The driver's public commands and state** carry anything driver-specific: a field that
  wants its pick to land in TYPE runs `whistle.mode:type` itself after picking. It does nothing
  in TYPE, so the field needs no check of the mode.

## Considered options

- A `{ to: "type" }` request and a `show` move in keynav: they tie keynav to one driver's modes.
- Sending fields every raw key and letting them decide: each field would bind its own
  navigation, rebinding in whistle.json would stop reaching fields, a field could keep keys like
  Escape from the driver, and the hints couldn't tell what a key does.
- Passing the key that caused a move along with it: it invites fields to branch on physical
  keys and undoes rebinding.

## Consequences

- RECIPE tells integrating agents how a clone picks into TYPE and shows, and uses those names
  (GLOSSARY: Pick, Show).
- Stock fields keep Herdr's behaviour: Pick on Herdr's own lists stays in WHISTLE.
