// whistle.js: read whistle's state from another mod, and offer whistle mappings for your mod's
// commands. Copy this file into your mod's folder (a mod can't import from another's); the
// contracts are the wire formats in whistle's docs/contracts/state.md and mod-mappings.md, not
// these functions.
//
// shared("whistle"):          { v: 1, mode: "type" | "whistle", enabled, sequence: null |
//                               { keys, group }, pane: the terminal pane whistle has selected | null }
//                             Written only by whistle. `v` goes up only on breaking changes; new
//                             fields may come under v 1, and a reader ignores fields it doesn't know.
// shared("whistle.mappings"): { [mod]: { v: 1, map } }, each mod's offered mappings under its
//                             name; a mod writes only its own entry.

import { shared, setShared } from "herdr";

// The v1 fields of a shared("whistle") value, or null: whistle hasn't published (not
// installed, not loaded yet, or standing aside) or publishes a version this copy can't read.
export function readState(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  const { mode, enabled, sequence, pane } = value;
  return { mode, enabled, sequence, pane };
}

// Whistle's state now: call it when you draw.
export const readWhistle = () => readState(shared("whistle"));

// Offers whistle your mod's mappings and groups (mod: your mod's folder name, as its blocks
// carry it in the layout; map: whistle's map format). They count while your mod is in the shown
// layout. Call it again to change them; it writes only when your entry differs, and keeps the
// other mods' entries.
export function offerMappings(mod, map) {
  const all = shared("whistle.mappings");
  const others = all && typeof all === "object" && !Array.isArray(all) ? all : {};
  const want = { v: 1, map };
  if (JSON.stringify(others[mod]) === JSON.stringify(want)) return;
  setShared("whistle.mappings", { ...others, [mod]: want });
}
