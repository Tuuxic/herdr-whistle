// whistle.js: read whistle's state from another mod. Copy this file into your mod's folder
// (a mod can't import from another's); the contract is the wire format in whistle's
// docs/contracts/state.md, not these functions.
//
// shared("whistle"): { v: 1, mode: "type" | "whistle", enabled, sequence: null | { keys, group },
//                      pane: the terminal pane whistle has selected | null }
// Written only by whistle. `v` goes up only on breaking changes; new fields may come under
// v 1, and a reader ignores fields it doesn't know.

import { shared } from "herdr";

// The v1 fields of a shared("whistle") value, or null: whistle hasn't published (not
// installed, not loaded yet, or standing aside) or publishes a version this copy can't read.
export function readState(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return null;
  const { mode, enabled, sequence, pane } = value;
  return { mode, enabled, sequence, pane };
}

// Whistle's state now: call it when you draw.
export const readWhistle = () => readState(shared("whistle"));
