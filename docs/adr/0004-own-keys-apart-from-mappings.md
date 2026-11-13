# Own keys apart from mappings; defaults name only Herdr

Whistle's config has two key sections: `"map"` (mappings: key → command or group, shown in the
hints) and `"keys"` (own keys: action → keys, never in the hints). Own keys weren't folded into
`"map"` as hidden entries, because moving one would mean nulling the old key and adding a new
one, and a list per action reads as what it is. The defaults (`mappings.json`) name only
Herdr's own commands; keys for a layout's mods live in that layout's whistle block, so whistle
never depends on a layout (ADR 0002). People's whistle.json files rely on both formats.
