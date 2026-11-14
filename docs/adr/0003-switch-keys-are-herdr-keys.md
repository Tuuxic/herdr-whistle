# Switch keys are Herdr keys; everything inside WHISTLE is whistle's config

In TYPE the focused terminal holds the keyboard and whistle never sees a key, so only a
keys.json binding can enter WHISTLE: the switch keys (`whistle.whistle`, `whistle.enter`,
`whistle.type`) stay regular Herdr keys, merged by hand. Every key that acts inside WHISTLE
(Ctrl+H/J/K/L included, though they look like Herdr chords) is whistle's config, so one file
says what WHISTLE does. Rejected: configuring the switch keys in whistle.json too, which would
mean whistle writing keys.json's global and terminal sections, not just its own `mod:whistle`
section (ADR 0001).

## Consequences

- TYPE belongs to the person: the switch key is the only TYPE key whistle ships (global
  `ctrl-space` → `whistle.whistle`, with `ctrl-space` → `whistle.type` in `mod:whistle`). The
  docs say what it takes (NUL / Emacs set-mark in terminal programs; the input-source switch
  on macOS, the Chinese IME on Windows, fcitx5 on Linux) and name `ctrl-shift-space` as the
  fallback.
- `ctrl-[` → `whistle.enter` in the `terminal` section was dropped from the shipped keys: it
  takes Esc-by-Ctrl+[ from every terminal program and can't be pressed on layouts without an
  unshifted `[`. The docs may offer it as an opt-in.
