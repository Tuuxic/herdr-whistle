// What a key press means in WHISTLE, decided without doing it: main.js carries out the answer.
// Pure (no Herdr calls), so tests/keymap.test.js can check it outside the app.
//
// resolve(conf, sequence, field, name) -> { sequence, act }
//   conf:     config.js load() / compose() result (map, own, keys)
//   sequence: null, or the key sequence so far: { path: ["w"], node: <group's map>, title }
//   field:    "terminal", "keynav" (another mod's field) or null (none selected)
//   name:     keynames.js keyName(e)
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

// The next key of a key sequence: cancel, back up a level, go into a group, run an entry,
// or end with "<keys> is not mapped".
function inSequence(conf, p, name) {
  const kind = conf.own?.get(name)?.kind;
  if (kind === "cancel") return { sequence: null, act: { show: true } };
  if (kind === "back") {
    if (p.path.length <= 1) return { sequence: null, act: { show: true } };
    return { sequence: at(conf, p.path.slice(0, -1)), act: { show: true } };
  }
  const v = p.node?.[name];
  if (isGroup(v)) {
    const next = { path: [...p.path, name], node: v.map, title: v.name ?? name };
    return { sequence: next, act: { show: true } };
  }
  if (Array.isArray(v)) return { sequence: null, act: { run: v } };
  const keys = [...p.path, name].map(keyLabel).join(" ");
  return { sequence: null, act: { flash: `${keys} is not mapped` } };
}

// What key name does: in a key sequence, the sequence's next key; else a mapped key, then
// whistle's own keys, then what the selected field does with it.
export function resolve(conf, sequence, field, name) {
  if (sequence) return inSequence(conf, sequence, name);
  const mapped = conf.map?.[name];
  if (mapped) {
    if (!isGroup(mapped)) return { sequence: null, act: { run: mapped } };
    const next = { path: [name], node: mapped.map, title: mapped.name ?? name };
    return { sequence: next, act: { show: true } };
  }
  const own = conf.own?.get(name);
  const none = { sequence: null, act: null };
  if (own?.kind === "field") return { sequence: null, act: { field: own.dir } };
  if (own?.kind === "type") return { sequence: null, act: { type: true } };
  if (!own && isChord(name)) return none;
  if (field === "terminal") {
    if (own?.kind === "move") return { sequence: null, act: { pane: own.dir } };
    if (own?.kind === "open") return { sequence: null, act: { type: true } };
    return none;
  }
  if (field !== "keynav") return none;
  // A field gets moves and open, and any other visible character as key-<char>.
  if (own?.kind === "move") return { sequence: null, act: { keynav: own.dir } };
  if (own?.kind === "open") return { sequence: null, act: { keynav: "open" } };
  if (!own && name.length === 1 && name.trim()) {
    return { sequence: null, act: { keynav: `key-${name}` } };
  }
  return none;
}

// The hints for a key sequence: { keys: "SPC a", title, items: choices, exit: "Esc · ⌫" }
// (the first cancel and back keys), or null when there is none.
export function describe(conf, sequence) {
  if (!sequence) return null;
  const ks = conf?.keys ?? {};
  const exit = [ks.cancel?.[0], ks.back?.[0]].filter(Boolean).map(keyLabel).join(" · ");
  const keys = sequence.path.map(keyLabel).join(" ");
  return { keys, title: sequence.title, items: choices(sequence.node), exit };
}
