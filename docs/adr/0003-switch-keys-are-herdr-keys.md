# Switch keys are Herdr keys; everything inside WHISTLE is whistle's config

In TYPE the focused terminal holds the keyboard and whistle never sees a key, so only a
keys.json binding can enter WHISTLE: the switch keys (`whistle.whistle`, `whistle.enter`,
`whistle.type`) stay regular Herdr keys, merged by hand. Every key that acts inside WHISTLE
(Ctrl+H/J/K/L included, though they look like Herdr chords) is whistle's config, so one file
says what WHISTLE does. Rejected: configuring the switch keys in whistle.json too, which would
mean whistle writing keys.json's global and terminal sections, not just its own `mod:whistle`
section (ADR 0001).
