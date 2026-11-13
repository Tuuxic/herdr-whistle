// keynav v1: keyboard navigation that any driver mod can offer (whistle is one). A mod that
// takes part announces each of its copies as a field; while a driver moves through the
// layout, it names the active field in shared("keynav") and sends that mod "keynav-<move>"
// commands. The mod keeps its own cursor and decides how its field looks while active.
// Without a driver, nothing is ever active.
//
// A mod can't import from another mod's folder: every keynav mod has a copy of this
// file. Keep the copies the same.
//
// shared("keynav.fields"): { [key]: { v: 1, mod, props, label } }, key = fieldKey(mod, props)
// shared("keynav"):        { v: 1, active: key | "terminal" | null, pane }  (the driver's)
// shared("keynav.request"): { to: "terminal", at } after the mod focused a terminal: move on
//                           { hold: true, at }    after it moved the keyboard: keep it
// moves: up, down, left, right, open, key-<character> (e.g. key-x)

import { shared, setShared } from "herdr";

// Props as text with sorted keys, so the driver and the mod spell the same field the same way.
const stable = (v) => (v && typeof v === "object" && !Array.isArray(v)
  ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
  : JSON.stringify(v ?? null));
export const fieldKey = (mod, props) => `${mod} ${stable(props ?? {})}`;

// Announces this copy as a field. Call it from render: two copies announcing at once can
// overwrite each other, so a copy that finds itself missing announces again.
export function announce(mod, props, label) {
  const key = fieldKey(mod, props);
  const all = shared("keynav.fields") ?? {};
  if (all[key]?.v === 1 && all[key].label === label) return key;
  setShared("keynav.fields", { ...all, [key]: { v: 1, mod, props: props ?? {}, label } });
  return key;
}

export const isActive = (key) => shared("keynav")?.active === key;

// The move a "keynav-*" command asks for ("down", "open", "key-x"); null for other commands.
export const move = (c) => (typeof c === "string" && c.startsWith("keynav-") ? c.slice(7) : null);

// True once each time the field becomes active: the mod puts its cursor where it wants it.
export function entered(self, key) {
  const on = isActive(key);
  const first = on && !self.keynavWasActive;
  self.keynavWasActive = on;
  return first;
}

// After the mod focused a terminal (an agent, say): the driver should move on to it.
export const toTerminal = () => setShared("keynav.request", { to: "terminal", at: Date.now() });
// After the mod moved the keyboard elsewhere (selected another space): the driver keeps it.
export const keepKeys = () => setShared("keynav.request", { hold: true, at: Date.now() });
