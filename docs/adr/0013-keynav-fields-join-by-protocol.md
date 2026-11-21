# Keynav: fields join by protocol, each with its own entry and declared keys

Whistle names no other mod, and no mod depends on whistle. A mod becomes a **field** by taking
part in keynav, a wire format in Herdr's shared state: it announces itself, draws its own cursor
while selected, and handles `<mod>.keynav-<move>` commands. Each mod carries its own copy of
`keynav.js` instead of importing it from whistle, so every mod loads and works without whistle
installed, and whistle without any of them.

Herdr's shared state is last-write-wins with no atomic update, so the format gives every field
keys of its own:

- Each field writes only its own entry, `shared("keynav.field:<field key>") = { v: 3, label,
  keys }`. The driver looks entries up from the blocks it finds in `layout()`, so stale entries
  are harmless.
- Requests go in a slot per field, `shared("keynav.request:<field key>")`, one shape,
  `{ after: "terminal" | "hold", at }`, and the driver reads only the selected field's slot.
- A field lists its **declared keys** (`keys: { d: "Delete" }`): any non-chord key, which it
  can change at any time by announcing again. While the field is selected, its declared keys
  win over mappings and show in the hints, but never over own keys. Keys it doesn't declare
  never reach it.
- The driver publishes `shared("keynav") = { v: 3, active }`, the "you are selected" signal.
- The contract is the wire format only. `keynav.js` is a reference helper that each mod copies,
  and its functions may change between releases.
- `v` goes up only on breaking changes. New optional fields are added under the same `v`, and
  both sides ignore fields they don't know.

## Considered options

- One object holding every field, and one request slot: copies announcing at the same moment
  lose each other's entries, and any mod can steer the driver.
- One entry per mod: copies of the same mod still race.
- A single request slot with a `from` field.
- Sending a field every unmapped character: a mapping could quietly shadow a field's key, and
  the hints couldn't show what the field does.
- A shared library imported from whistle: every field would need whistle installed.

## Consequences

- Copies of `keynav.js` can drift; the `v` field lets a driver tell them apart. An entry with
  another `v` isn't a field.
- Moves stay up, down, left, right and pick
  ([ADR 0014](0014-keynav-moves-only-what-every-field-shares.md)). At its edge a field decides
  what to do, and nothing spills into the next field. Leaving a field is always the driver's
  job, and a request never names another field.
- A declared key that is also an own key is ignored and listed as a config problem.
- Only one driver is assumed at a time.
- Authors get a written spec, the reference `keynav.js`, and a checker test mod run with
  `herdr-app check` that plays the driver.
