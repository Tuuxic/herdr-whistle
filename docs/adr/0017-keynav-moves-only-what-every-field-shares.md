# Keynav moves carry only what every field shares

Making Enter on a spaces or agents field land in TYPE, and Space show an item without leaving
WHISTLE, raised the question of where such behaviour goes.
The first proposal added to keynav: a `{ to: "type" }` request and a `show` move. But TYPE is
whistle's mode, not keynav's, which knows no modes, and every such feature would wait on a
spec change. We decided to draw the line in three:

- **Moves** (up, down, left, right, pick) are only what every kind of field shares, the
  terminal and stock fields included. The list grows only for something just as universal.
- **Declared keys** carry everything one field does: Space to show, d to delete.
- **The driver's public commands and state** carry anything driver-specific: a field that
  wants its pick to land in TYPE runs `whistle.type` itself after picking. It does nothing in
  TYPE, so the field needs no check of the mode.

Rejected: sending fields every raw key and letting them decide. Each field would bind its own
navigation, rebinding in whistle.json would stop reaching fields, a field could keep keys like
Escape from the driver, and the hints couldn't tell what a key does; keynav v1's
`key-<char>` for every character went for the same reasons (ADR 0009). Also rejected: passing
the key that caused a move along with it, which invites fields to branch on physical keys and
undoes rebinding.

## Consequences

- Whistle's code doesn't change for this; RECIPE tells integrating agents how a clone picks
  into TYPE and shows, and uses those names (GLOSSARY: Pick, Show).
- Stock fields keep their behaviour: Pick on Herdr's own lists stays in WHISTLE.
- Keynav v3 renames the move open to pick (`<mod>.keynav-pick`) and gives requests one shape,
  `{ after: "terminal" | "hold", at }`, in place of `{ to: "terminal" }` and `{ hold: true }`;
  a new kind of request would be a new value. A request never names another field: moving
  between fields stays the driver's job, and a field doesn't know the other mods or the
  layout's blocks.
- Whistle drives v2 and v3 fields alike for now, and its settings ask v2 fields to update
  their `keynav.js`; since nothing breaks for people, it ships in a 1.x minor. whistle.json's
  own key `open` becomes `pick`; `open` is still read and listed as a config problem.
