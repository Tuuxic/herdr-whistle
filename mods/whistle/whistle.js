// whistle.js: read whistle's public keys from another mod, and offer whistle mappings for your
// mod's commands. Copy this file into your mod's folder (a mod can't import from another's); the
// contracts are the wire formats in whistle's docs/contracts/ (state.md, hints.md, events.md,
// config.md, mod-mappings.md), not these functions.
//
// shared("whistle"):          { v: 1, mode: "type" | "whistle", enabled, sequence: null |
//                               { keys, group }, pane: the terminal pane whistle has selected | null,
//                               onTerminal: whether the terminal is the selected field in WHISTLE,
//                               inert?: { problem, fix }: why whistle stands aside (2.0.0) }
// shared("whistle.hints"):    { v: 1, keys, title, items: [{ key, label, group }], exit } | null
// shared("whistle.events"):   { v: 1, events: [{ seq, kind, text, ...data }] }, the last 8
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
  const { mode, enabled, sequence, pane, onTerminal, inert } = value;
  // onTerminal came later under v 1 (whistle 1.0.0 has it); missing, it reads as false. inert
  // came in 2.0.0; missing, whistle runs (or is older), so it reads as null.
  return { mode, enabled, sequence, pane, onTerminal: onTerminal === true, inert: inert ?? null };
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

// The new events now (see eventsSince): call it when you draw.
export const readEvents = (last = 0) => eventsSince(shared("whistle.events"), last);

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
