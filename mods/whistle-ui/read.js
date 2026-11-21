// Whistle's public keys read as their contracts say (docs/contracts/state.md, hints.md,
// events.md, config.md): the pure readers of whistle's whistle.js, copied word for word (a test
// checks), without the parts that call Herdr, so whistle-ui's core stays pure.

// The v1 fields of a shared("whistle") value, or null: whistle hasn't published (not
// installed, not loaded yet, or standing aside for another copy) or publishes a version this
// copy can't read.
export function readState(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  const { mode, enabled, sequence, pane, onTerminal, inert } = value;
  // onTerminal came later under v 1 (whistle 1.0.0 has it); missing, it reads as false. inert
  // came in 2.0.0; missing, whistle runs (or is older), so it reads as null.
  return { mode, enabled, sequence, pane, onTerminal: onTerminal === true, inert: inert ?? null };
}

const v1 = (value) => Boolean(value) && typeof value === "object" && value.v === 1;

// The hints of a shared("whistle.hints") value, { keys, title, items, exit }, or null: none to
// show (TYPE, no group reached), or a version this copy can't read.
export function hintsOf(value) {
  if (!v1(value)) return null;
  const { keys, title, items, exit } = value;
  return { keys, title, items, exit };
}

// The events in a shared("whistle.events") value that came after the last one you handled
// (last: its seq, 0 for none), and the new last: { events, last }. Seqs rise for as long as
// whistle runs; when they went back (whistle started again), every event in the feed is new.
// Keep `last` between draws and show each event once.
export function eventsSince(value, last = 0) {
  if (!v1(value) || !Array.isArray(value.events) || !value.events.length) return { events: [], last };
  const newest = value.events.at(-1).seq;
  const events = newest < last ? value.events : value.events.filter((e) => e.seq > last);
  return { events, last: newest };
}

// The config of a shared("whistle.config") value, { problems, mods, conflicts, overrides }, or
// null: whistle hasn't published, or a version this copy can't read.
export function configOf(value) {
  if (!v1(value)) return null;
  const { problems, mods, conflicts, overrides } = value;
  return { problems, mods, conflicts, overrides };
}
