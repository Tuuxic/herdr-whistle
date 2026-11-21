# Switch keys are Herdr keys; everything inside WHISTLE is whistle's config

In TYPE the focused terminal holds the keyboard and whistle never sees a key, so only a
keys.json binding can enter WHISTLE: the switch keys (`whistle.switch-mode`,
`whistle.mode:whistle`, `whistle.mode:type`) stay regular Herdr keys, merged by hand. Every key
that acts inside WHISTLE (Ctrl+H/J/K/L included, though they look like Herdr chords) is
whistle's config, so one file says what WHISTLE does.

## Considered options

- Configuring the switch keys in whistle.json too: whistle would write keys.json's global and
  terminal sections, not just its own `mod:whistle` section
  ([ADR 0009](0009-whistle-claims-keys-in-keys-json.md)).
- Shipping `ctrl-[` in the `terminal` section: it takes Esc-by-Ctrl+[ from every terminal
  program and can't be pressed on layouts without an unshifted `[`. The guide offers it as an
  opt-in.

## Consequences

- TYPE belongs to the person: the switch key is the only TYPE key whistle ships (global
  `ctrl-space` → `whistle.switch-mode`, with `ctrl-space` → `whistle.mode:type` in
  `mod:whistle`). The docs say what it takes (NUL / Emacs set-mark in terminal programs; the
  input-source switch on macOS, the Chinese IME on Windows, fcitx5 on Linux) and name
  `ctrl-shift-space` as the fallback.
