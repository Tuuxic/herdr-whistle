// Whistle's public keys read as their contracts say (docs/contracts/state.md, hints.md,
// events.md, config.md): the pure readers of whistle's whistle.js, copied word for word (a test
// checks), without the parts that call Herdr, so whistle-ui's core stays pure.

// The v1 fields of a shared("whistle") value, or null: whistle hasn't published (not
// installed, not loaded yet, or standing aside for another copy) or publishes a version this
// copy can't read.
export function readState(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  const { mode, enabled, sequence, pane, onTerminal, field, inert } = value;
  return { mode, enabled, sequence, pane, onTerminal, field, inert };
}

const v1 = (value) => Boolean(value) && typeof value === "object" && value.v === 1;

// The hints of a shared("whistle.hints") value, { keys, title, items, exit }, or null: none to
// show (TYPE, no group reached), or a version this copy can't read.
export function hintsOf(value) {
  if (!v1(value)) return null;
  const { keys, title, items, exit } = value;
  return { keys, title, items, exit };
}

// Whether an event passes a filter: { groups, kinds } (an event in any listed group, or of any
// listed kind; with neither given, every event) or a predicate (event) => boolean. With no
// filter, every event does.
export function matches(filter, event) {
  if (typeof filter === "function") return Boolean(filter(event));
  if (!filter || typeof filter !== "object") return true;
  const { groups, kinds } = filter;
  if (!Array.isArray(groups) && !Array.isArray(kinds)) return true;
  return (Array.isArray(groups) && Array.isArray(event.groups) && event.groups.some((g) => groups.includes(g)))
    || (Array.isArray(kinds) && kinds.includes(event.kind));
}

// The events in a shared("whistle.events") value that came after the last one you handled
// (last: its seq, 0 for none) and pass filter (matches), the new last, and how many fell out of
// the feed before you read them: { events, last, missed }. `last` moves past every event read,
// matched or not, so keep it between draws and handle each event once. Seqs rise for as long as
// whistle runs; when they went back (whistle started again), every event in the feed is new and
// none were missed.
export function eventsSince(value, last = 0, filter) {
  if (!v1(value) || !Array.isArray(value.events) || !value.events.length) return { events: [], last, missed: 0 };
  const all = value.events, newest = all.at(-1).seq;
  const again = newest < last;
  const fresh = again ? all : all.filter((e) => e.seq > last);
  return { events: fresh.filter((e) => matches(filter, e)), last: newest, missed: again ? 0 : Math.max(0, all[0].seq - last - 1) };
}

// The config of a shared("whistle.config") value, { problems, mods, conflicts, overrides }, or
// null: whistle hasn't published, or a version this copy can't read.
export function configOf(value) {
  if (!v1(value)) return null;
  const { problems, mods, conflicts, overrides } = value;
  return { problems, mods, conflicts, overrides };
}
