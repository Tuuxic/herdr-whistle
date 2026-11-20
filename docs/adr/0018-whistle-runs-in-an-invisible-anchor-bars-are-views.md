# Whistle runs in an invisible anchor; bars are views

Whistle held the keyboard through its bar, so hiding every bar rested whistle: the bar, meant
as an aid, decided whether whistle worked. We decided that whistle runs in an anchor, a whistle
block sized 0 px that draws nothing, and that bars only draw whistle state, so showing or
hiding a bar changes what you see, never what whistle does. Herdr can't run it in a hidden
block: a hidden copy isn't loaded for commands ("need the mod loaded"), so Ctrl+Space never
reaches it. A sandbox spike showed a 0 px block counts as shown, gets global-bound commands,
takes focus, and gets plain keys and its `mod:whistle` keys.

## Considered options

- A 2×2 frameless overlay: also passed the spike, but some block copy must open it and reopen
  it after every layout switch, and it is 2 px of something on screen.
- A bar that draws nothing, collapsed by whistle instead of hidden: simplest, but the bar
  still decides whether whistle runs.

## Consequences

- A layout marks its anchor with the prop `anchor: true` (sized 0 px); a whistle block without
  it is a bar, so old layouts read unchanged.
- One anchor drives a layout: the first in layout order; any others stand aside and are a
  config problem.
- The layout's whistle props (`enabled`, `hints`, `nav`, `mods`, the hints' place) live on the
  anchor; bars keep only their spot name and their look.
- Herdr hands every command and `mod:whistle` key to every shown copy, so bar copies ignore
  them; only the anchor acts.
- With no bar showing, WHISTLE carries on, and the hints box docks where the picked bar would
  be (bottom right with no spot at all). Flashes and the mode badge go unseen.
- A layout without an anchor keeps working: a bar stands in for it, as before, and hiding that
  bar rests whistle there. Integrate offers to add the anchor.
- Changing the anchor's props restarts its copy and drops the keyboard, as for any block.
- Replaces ADR 0011's "a hidden copy rests" for layouts with an anchor.
