# Whistle publishes facts; clients show them

Whistle's views were part of whistle: whistle decided their text, timing and geometry, and kept
hint items and config data private ([ADR 0010](0010-whistle-state-one-public-key.md)), so the
bar couldn't be replaced, and every bar copy ran whistle's whole shell only to throw the result
away. We decided that whistle publishes facts and takes commands, and **clients**, mods such as
whistle-ui, decide what to show and how. Whistle runs in its block, the anchor, and draws
nothing: no bar, no hints box, no dialog, no flash text with a lifetime, no "Whistle off", no
problem marker, no docking. It publishes the whistle state and three more public keys,
`whistle.hints`, `whistle.events` and `whistle.config`, and takes the settings commands, which
write whistle.json for a client.

It supersedes:

- ADR 0010's private hints and single public key: there are four public keys, split by how
  often they change, and hint items are public.
- ADR 0018's fallback and `anchor` prop: every whistle block is the anchor. The first in layout
  order runs; others are listed as config problems and act on nothing; blocks with the same props
  make whistle inert, with one notification saying to keep one. A layout without a whistle block
  runs no whistle, and no bar stands in.
- ADR 0019's docking by whistle: whistle-ui docks the hints box on its shown bar, or at the
  window's bottom right with none.

## Considered options

- The anchor computing presentation in a presenter module: whistle would still know bars and
  overlays.
- Clients deriving everything from the whistle state: each would re-run whistle's config and
  keymap.
- Keeping the fallback, deprecated, until 3.0: whistle has no users yet, so 2.0.0 breaks once.

## Consequences

- Hiding every bar costs nothing: whistle runs in the anchor, and whistle-ui's 0 px corner block
  shows the hints at the window's bottom right.
- Herdr has no per-key subscription: any `setShared` re-renders every mod. Whistle writes each
  public key only when it changes, and the event feed carries a rising `seq` so a client shows
  each event once.
- The inert notification isn't remembered per folder: a new copy skips it when the
  published whistle state already gives the same reason. A copy standing aside for another
  copy publishes no state, so after a layout change it may post its notification again.
