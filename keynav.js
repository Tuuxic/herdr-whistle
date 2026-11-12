// keynav v1: keyboard navigation that any driver mod can offer (whistle is one). A mod that
// takes part announces each of its copies as a field; while a driver moves through the
// layout, it names the active field in shared("keynav") and sends that mod "keynav-<move>"
// commands. The mod keeps its own cursor and draws it. Without a driver, nothing is ever
// active and none of this shows.
//
// A mod can't import from another mod's folder: every taking part mod has a copy of this
// file. Keep the copies the same.
//
// shared("keynav.fields"): { [key]: { v: 1, mod, props, label } }, key = fieldKey(mod, props)
// shared("keynav"):        { v: 1, active: key | "terminal" | null, pane }  (the driver's)
// shared("keynav.request"): { to: "terminal", at }  a mod asks the driver to move on
// moves: up, down, left, right, open, key-<character> (e.g. key-x)

import { div } from "gpui-kit";
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

// True once each time the field becomes active: the mod puts its cursor on its current item.
export function entered(self, key) {
  const on = isActive(key);
  const first = on && !self.keynavWasActive;
  self.keynavWasActive = on;
  return first;
}

// One step through a list of ids, staying at the ends.
export function step(ids, cur, d) {
  if (!ids.length) return null;
  const i = ids.indexOf(cur);
  return ids[i < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, i + d))];
}

// The active field glows, its cursor item gets an outline in the same color.
export const glow = (t) => t.foreground + "b3";
export const frame = (t) => div().absolute().top(0).left(0).right(0).bottom(0).border_2().border_color(glow(t));

// After the mod focused a terminal (an agent, say): the driver should move on to it.
export const toTerminal = () => setShared("keynav.request", { to: "terminal", at: Date.now() });
