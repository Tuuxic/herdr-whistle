// whistle.js: read whistle's public keys from another mod, and offer whistle mappings for your
// mod's commands. Copy this file into your mod's folder (a mod can't import from another's); the
// contracts are the wire formats in whistle's docs/contracts/ (state.md, hints.md, events.md,
// config.md, mod-mappings.md), not these functions.
//
// shared("whistle"):          { v: 1, mode: "type" | "whistle", enabled, sequence: null |
//                               { keys, group }, pane: the terminal pane whistle has selected | null,
//                               onTerminal: whether the terminal is the selected field in WHISTLE,
//                               field: the selected field's block id in WHISTLE | null,
//                               inert: { problem, fix }: why whistle stands aside | null }
// shared("whistle.hints"):    { v: 1, keys, title, items: [{ key, label, group }], exit } | null
// shared("whistle.events"):   { v: 1, events: [{ seq, kind, groups, text, ...data }] }, the last 32
// shared("whistle.config"):   { v: 1, problems, mods: [{ name, on, problems }], conflicts, overrides }
//                             Each written only by whistle. `v` goes up only on breaking changes;
//                             new fields (and event kinds) may come under v 1, and a reader
//                             ignores what it doesn't know.
// shared("whistle.mappings"): { [mod]: { v: 1, map } }, each mod's offered mappings under its
//                             name; a mod writes only its own entry.

import { shared, setShared } from "herdr";

// The v1 fields of a shared("whistle") value, or null: whistle hasn't published (not
// installed, not loaded yet, or standing aside for another copy) or publishes a version this
// copy can't read.
export function readState(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  const { mode, enabled, sequence, pane, onTerminal, field, inert } = value;
  return { mode, enabled, sequence, pane, onTerminal, field, inert };
}

// Whistle's state now: call it when you draw.
export const readWhistle = () => readState(shared("whistle"));

const v1 = (value) => Boolean(value) && typeof value === "object" && value.v === 1;

// The hints of a shared("whistle.hints") value, { keys, title, items, exit }, or null: none to
// show (TYPE, no group reached), or a version this copy can't read.
export function hintsOf(value) {
  if (!v1(value)) return null;
  const { keys, title, items, exit } = value;
  return { keys, title, items, exit };
}

// The hint items now: call it when you draw.
export const readHints = () => hintsOf(shared("whistle.hints"));

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

// The new events now, filtered (see eventsSince): call it when you draw.
export const readEvents = (last = 0, filter) => eventsSince(shared("whistle.events"), last, filter);

// The config of a shared("whistle.config") value, { problems, mods, conflicts, overrides }, or
// null: whistle hasn't published, or a version this copy can't read.
export function configOf(value) {
  if (!v1(value)) return null;
  const { problems, mods, conflicts, overrides } = value;
  return { problems, mods, conflicts, overrides };
}

// Whistle's config now: call it when you draw.
export const readConfig = () => configOf(shared("whistle.config"));

// Offers whistle your mod's mappings and groups (mod: your mod's folder name, as its blocks
// carry it in the layout; map: whistle's map
// format). They count while your mod is in the shown layout. Call it again to change them; it
// writes only when your entry differs, and keeps the other mods' entries.
export function offerMappings(mod, map) {
  const all = shared("whistle.mappings");
  const others = all && typeof all === "object" && !Array.isArray(all) ? all : {};
  const want = { v: 1, map };
  if (JSON.stringify(others[mod]) === JSON.stringify(want)) return;
  setShared("whistle.mappings", { ...others, [mod]: want });
}
