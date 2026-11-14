# Whistle's defaults drive Herdr's stock blocks with Herdr commands

Herdr's own spaces, tabs and agents mods take no part in keynav, yet h/j/k/l should move
through them out of the box. We decided that whistle's defaults, and only the defaults, hold a
table from those stock mods to Herdr's own commands (spaces: `space.next`/`space.prev`; agents:
`agent.next`/`agent.prev`, with open going on to the terminal field; tabs:
`tab.next`/`tab.prev`), so each of their blocks is a stock field. This is the one place whistle
names a mod, and only Herdr's own, the same line ADR 0004 draws for the default mappings;
layouts and whistle.json can't add entries, so keynav (ADR 0002) stays the only way any other
mod becomes a field. A mod that announces itself through keynav wins over the table.

Rejected: keynav forks of the stock mods shipped with whistle. Herdr's own mods and layouts are
read-only, so a fork only works in a layout that points at it and never reaches someone on the
stock `main` layout, and forks drift from Herdr's updates. Also rejected: an outline around the
selected stock block. Herdr offers it only as a border saved into the person's layout or as
overlay strips that catch the mouse and guess the block's position.

## Consequences

- Stock fields have no cursor: Herdr's commands select and open in one step, so moving to an
  item opens it, and only the bar shows which stock field is selected.
- The files block is not a field: Herdr gives it no commands or state. A keynav fork would make
  it one.
- Tab moves skip settled tabs and agent moves skip sub-agents without a pane, as Herdr's
  commands do.
