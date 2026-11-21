# Whistle runs in its block, the anchor, which draws nothing

Whistle needs a block of its own to hold the keyboard in WHISTLE and to take its commands, and
that block must not be something a person hides to tidy the screen. We decided that every
whistle block is the **anchor**: sized 0 px, it draws nothing, and only it runs whistle. Herdr
can't run whistle in a hidden block: a hidden copy isn't loaded for commands ("need the mod
loaded"), so Ctrl+Space would never reach it. A sandbox spike showed a 0 px block counts as
shown, gets global-bound commands, takes focus, and gets plain keys and its `mod:whistle` keys.

- The first whistle block in layout order runs whistle. Any other is listed as a config problem,
  and its copy acts on nothing.
- Copies are told apart only by their props, so whistle blocks with the same props can't tell
  which comes first: whistle is inert, with one Herdr notification saying to keep one.
- A layout without a whistle block runs no whistle. Nothing stands in for it.
- The layout's whistle props (`mappings`, `keys`, `mods`, `enabled`, `nav`) live on the anchor.

## Considered options

- A 2×2 frameless overlay: also passed the spike, but some block copy must open it and reopen
  it after every layout switch, and it is 2 px of something on screen.
- Running whistle in a visible bar: the bar, meant as an aid, would decide whether whistle
  works, and hiding it would rest whistle.
- A marker prop (`anchor: true`) telling the anchor from bars: whistle draws no bars
  ([ADR 0006](0006-whistle-publishes-facts-clients-show-them.md)), so there is nothing to tell
  it from.

## Consequences

- Showing or hiding a client's bar changes what you see, never what whistle does.
- Herdr hands every command and `mod:whistle` key to every shown copy, so copies other than the
  one that runs ignore them.
- Changing the anchor's props restarts its copy and drops the keyboard, as for any block.
