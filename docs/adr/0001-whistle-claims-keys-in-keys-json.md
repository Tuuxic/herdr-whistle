# Whistle claims its keys in the person's keys.json

Herdr runs keys.json's bindings before a mod sees a key, so any key a global or layout section
binds (a layout's Ctrl+H for the previous tab) never reaches whistle, however whistle's config
maps it; only a `mod:whistle` section wins while whistle has the keyboard. We decided that
whistle writes its claimed keys there itself (`"<key>": "whistle.key-<key>"`), kept in step
with its config, rather than asking people to merge them by hand (every config change would
mean editing two files) or claiming nothing (chords and keys Herdr binds would silently not
work in WHISTLE).

## Consequences

- Herdr stops adding new default shortcuts to a keys.json that was edited, so the first claim
  ends those upgrades for a person whose file was still untouched.
- Whistle owns only entries of exactly its own form; anything else in `mod:whistle` is the
  person's and wins. It never writes while keys.error exists or its config failed to load,
  and it puts the old text back if Herdr rejects the new one.
