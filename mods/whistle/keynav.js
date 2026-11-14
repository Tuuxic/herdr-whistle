// keynav.js: make your mod a field that keyboard drivers (whistle is one) can select and drive.
// Copy this file into your mod's folder (a mod can't import from another's). The contract is
// the wire format in whistle's docs/contracts/keynav.md (keynav v2), not these functions,
// which may change between releases.
//
// shared("keynav.field:<fieldKey>"):   { v: 2, label, keys: { <key>: <label> } }  this field's entry
// shared("keynav.request:<fieldKey>"): { to: "terminal", at } | { hold: true, at } its request slot
// shared("keynav"):                    { v: 2, active: fieldKey | null }           the driver's
// commands to the mod: keynav-up, -down, -left, -right, -open, and keynav-key-<key> for a
// declared key (as the field wrote it).
//
// Without a driver nothing is ever active, and the mod works as it always does.

import { shared, setShared } from "herdr";

export const V = 2;
export const entryKey = (key) => `keynav.field:${key}`;
export const requestKey = (key) => `keynav.request:${key}`;

// Props as text with sorted keys, so the driver and the mod spell the same field the same way.
const stable = (v) => (v && typeof v === "object" && !Array.isArray(v)
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
  : JSON.stringify(v ?? null));
// A field's key: the mod's folder and the block's props.
export const fieldKey = (mod, props) => `${mod} ${stable(props ?? {})}`;

// A field's entry: its label for the bar and its declared keys ({ d: "Delete" }), keys without
// Ctrl, Alt or Super.
export const entry = (label, keys = {}) => ({ v: V, label, keys });

// Announces this copy as a field, or changes its label or declared keys. Call it from render:
// it writes only when the entry differs. Returns the field's key.
export function announce(mod, props, label, keys = {}) {
  const key = fieldKey(mod, props);
  const want = entry(label, keys);
  if (JSON.stringify(shared(entryKey(key))) !== JSON.stringify(want)) setShared(entryKey(key), want);
  return key;
}

// Whether the driver has this field selected now.
export const isActive = (key) => shared("keynav")?.active === key;

// The move a command asks for: "up", "down", "left", "right", "open"; null for any other.
const MOVES = ["up", "down", "left", "right", "open"];
export const move = (c) => (typeof c === "string" && c.startsWith("keynav-") && MOVES.includes(c.slice(7)) ? c.slice(7) : null);

// The declared key a command brings, as the field wrote it ("d"); null for any other.
export const declared = (c) => (typeof c === "string" && c.startsWith("keynav-key-") && c.length > 11 ? c.slice(11) : null);

// True once each time the field becomes active: put the cursor where you want it.
export function entered(self, key) {
  const on = isActive(key);
  const first = on && !self.keynavWasActive;
  self.keynavWasActive = on;
  return first;
}

// After the field focused a terminal pane (an agent, say): the driver selects the terminal.
export const toTerminal = (key) => setShared(requestKey(key), { to: "terminal", at: Date.now() });
// After the field moved the keyboard elsewhere (selected another space): the driver keeps it.
export const keepKeys = (key) => setShared(requestKey(key), { hold: true, at: Date.now() });
