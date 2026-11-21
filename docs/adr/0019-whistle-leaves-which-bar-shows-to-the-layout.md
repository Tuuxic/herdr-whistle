# Whistle leaves which bar shows to the layout

With an anchor, bars are only views ([ADR 0018](0018-whistle-runs-in-an-invisible-anchor-bars-are-views.md)),
but whistle still managed which bar showed: on every tick it showed the spot whistle.json's
`bar` named and hid the others. So any bar something else hid (a
`whistle.toggle-keep-mode:<bar>` key, `layout.hide`, a layout's own control) came back within a
tick, and there was no way to say "no bar". Herdr already owns and persists which blocks show
(clicks, shown/hidden included, live in `layouts/.state/` and survive restarts), so whistle.json's
`bar` duplicated that state and the two fought. We decided that whistle never shows or hides a
bar, in any layout: which bar shows is the layout's business, and Herdr remembers it.

- whistle.json's `bar` is ignored and listed as a config problem (source `whistle.json`),
  whatever its value. Whistle never rewrites whistle.json to remove it.
- The layout prop `bar` stays, as the spot's name only: copies are told apart by their props,
  and a bar publishes its size under `whistle.barsize:<folder>:<bar>`.
- With a bar shown, the hints box docks on the first shown bar in layout order, by the size it
  publishes. With no bar shown (every spot hidden, or no spot at all), it docks at the window's
  bottom right: 480 px wide (the window's width less 12 px, if narrower), 6 px in.
- A layout that offers several spots switches them with `layout.show` / `layout.hide` on the
  spots' blocks. No new whistle command, key or value.

## Considered options

- A "no bar" value for whistle.json's `bar` (`false`, `"none"`): it changes the key's type, and
  `"none"` collides with a spot name.
- A separate `barVisible` key, or `whistle.bar:<spot>` / `bar-hide` commands: the engine
  shouldn't manage a view.
- Applying whistle.json's pick only when it changes (edge-triggered): whistle.json and what's
  on screen drift apart, leaving two levers.
- Docking the hints box under the selected terminal: Herdr gives mods no pane geometry;
  whistle measures only the window (`viewport_size`) and its own bars.
- Docking at the last shown spot, or at the first spot, with every bar hidden.

## Consequences

- A bar hidden by anything stays hidden, and Herdr keeps it so across restarts.
- With no bar shown, flashes and the mode badge go unseen, as ADR 0018 already accepts. The
  mode is in the published whistle state, and standing aside posts one Herdr notification.
- Layouts without an anchor work as before: the shown bar's copy stands in for the anchor, and
  a hidden bar's copy rests. Hiding every bar there rests whistle; that case is rare.
- A minor release (1.3.0), by the precedent of `back` in 1.1.0: a whistle.json key that stops
  having an effect, while it still parses and is listed as a config problem, isn't a break.
  CONTRIBUTING's release checklist says so.
- Supersedes ADR 0018's docking "where the picked bar would be" with every bar hidden.
