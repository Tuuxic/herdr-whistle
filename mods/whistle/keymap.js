// What a key press means in WHISTLE, decided without doing it: main.js carries out the answer.
// Pure (no Herdr calls), so tests/keymap.test.js can check it outside the app.
//
// resolve(conf, pending, field, name) -> { pending, act }
//   conf:    config.js load() / compose() result (map, own, keys)
//   pending: null, or the key sequence so far: { path: ["w"], node: <group's map>, title }
//   field:   "terminal", "keynav" (another mod's field) or null (none selected)
//   name:    keynames.js keyName(e)
// act: { run: entry } | { field: dir } | { pane: dir } | { keynav: "down" | "open" | "key-x" }
//      | { type: true } | { show: true } (the sequence changed) | { flash: "t x is not mapped" }
//      | null (not handled: the key goes on to whatever else wants it)

import { isGroup } from "./config.js";
import { isChord, keyLabel } from "./keynames.js";

// The choices at one level, commands before groups, each sorted by key.
export const choices = (map) => Object.entries(map ?? {})
  .map(([key, v]) => ({
    key,
    label: isGroup(v) ? v.name ?? key : Array.isArray(v) ? v[0] : "?",
    group: Boolean(isGroup(v)),
  }))
  .sort((a, b) => a.group - b.group || a.key.localeCompare(b.key));

// A sequence at path: the group's map and name, walked down from the top of the map.
function at(conf, path) {
  let node = conf.map, title = "";
  for (const k of path) { title = node[k].name ?? k; node = node[k].map; }
  return { path, node, title };
}

// The next key of a pending sequence: cancel, back up a level, go into a group, run an entry,
// or end with "<keys> is not mapped".
function inSequence(conf, p, name) {
  const kind = conf.own?.get(name)?.kind;
  if (kind === "cancel") return { pending: null, act: { show: true } };
  if (kind === "back") {
    if (p.path.length <= 1) return { pending: null, act: { show: true } };
    return { pending: at(conf, p.path.slice(0, -1)), act: { show: true } };
  }
  const v = p.node?.[name];
  if (isGroup(v)) {
    const next = { path: [...p.path, name], node: v.map, title: v.name ?? name };
    return { pending: next, act: { show: true } };
  }
  if (Array.isArray(v)) return { pending: null, act: { run: v } };
  const keys = [...p.path, name].map(keyLabel).join(" ");
  return { pending: null, act: { flash: `${keys} is not mapped` } };
}

// What key name does: in a pending sequence, the sequence's next key; else a mapped key, then
// whistle's own keys, then what the selected field does with it.
export function resolve(conf, pending, field, name) {
  if (pending) return inSequence(conf, pending, name);
  const mapped = conf.map?.[name];
  if (mapped) {
    if (!isGroup(mapped)) return { pending: null, act: { run: mapped } };
    const next = { path: [name], node: mapped.map, title: mapped.name ?? name };
    return { pending: next, act: { show: true } };
  }
  const own = conf.own?.get(name);
  const none = { pending: null, act: null };
  if (own?.kind === "field") return { pending: null, act: { field: own.dir } };
  if (own?.kind === "type") return { pending: null, act: { type: true } };
  if (!own && isChord(name)) return none;
  if (field === "terminal") {
    if (own?.kind === "move") return { pending: null, act: { pane: own.dir } };
    if (own?.kind === "open") return { pending: null, act: { type: true } };
    return none;
  }
  if (field !== "keynav") return none;
  // A field gets moves and open, and any other visible character as key-<char>.
  if (own?.kind === "move") return { pending: null, act: { keynav: own.dir } };
  if (own?.kind === "open") return { pending: null, act: { keynav: "open" } };
  if (!own && name.length === 1 && name.trim()) {
    return { pending: null, act: { keynav: `key-${name}` } };
  }
  return none;
}

// The hints for a pending sequence: { keys: "SPC a", title, items: choices, exit: "Esc · ⌫" }
// (the first cancel and back keys), or null when none is pending.
export function describe(conf, pending) {
  if (!pending) return null;
  const ks = conf?.keys ?? {};
  const exit = [ks.cancel?.[0], ks.back?.[0]].filter(Boolean).map(keyLabel).join(" · ");
  const keys = pending.path.map(keyLabel).join(" ");
  return { keys, title: pending.title, items: choices(pending.node), exit };
}
