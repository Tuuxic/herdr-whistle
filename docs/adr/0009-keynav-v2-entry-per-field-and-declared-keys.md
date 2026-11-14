# Keynav v2: an entry per field, and declared keys

Keynav v1 (ADR 0002) put every field in one `shared("keynav.fields")` object and every request
in one `keynav.request` slot. Herdr's shared state is last-write-wins with no atomic update, so
copies announcing at the same moment lost each other's entries, and any mod could steer the
driver. A field also got every unmapped character as `key-<char>` without saying which it
handled, so a mapping could quietly shadow a field's key and the hints never showed them. We
decided that 1.0 freezes a breaking keynav v2 instead of v1 as it stands:

- Each field writes only its own entry, `shared("keynav.field:<fieldKey>") = { v: 2, label,
  keys }`. The driver looks entries up from the blocks it finds in `layout()`, so stale
  entries are harmless.
- Requests go in a slot per field, `shared("keynav.request:<fieldKey>")`, and the driver
  reads only the selected field's slot.
- A field lists its **declared keys** (`keys: { d: "Delete" }`): any non-chord key, which it
  can change at any time by announcing again. While the field is selected, its declared keys
  win over mappings and show in the hints, but never over own keys. Keys it doesn't declare
  never reach it.
- The contract is the wire format only: the shared keys, the entry shapes and the
  `<mod>.keynav-*` commands. `keynav.js` is a reference helper that each mod copies, and its
  functions may change between releases.
- `v` goes up only on breaking changes. New optional fields are added under the same `v`, and
  both sides ignore fields they don't know.

Rejected: freezing v1 and working around its races by announcing again; one entry per mod,
because copies of the same mod still race; a single request slot with a `from` field; and
sending undeclared characters to the field anyway.

## Consequences

- A copy that still announces v1 isn't a field. Whistle's settings say to update its
  `keynav.js`.
- Moves stay up, down, left, right and open. At its edge a field decides what to do, and
  nothing spills into the next field. Leaving a field is always the driver's job.
- A declared key that clashes with an own key is ignored and shown in settings.
- The driver publishes `shared("keynav") = { v: 2, active, pane }`. Only one driver is assumed
  at a time.
- Authors get a written spec, the reference `keynav.js`, and a checker test mod run with
  `herdr-app check` that plays the driver.
