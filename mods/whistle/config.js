// Whistle's settings and mappings, in three layers, each over the one before:
//   1. mappings.json in this folder: the defaults, Herdr's own commands only (an update
//      replaces this file, so don't edit it)
//   2. the layout: the whistle block's "mappings" prop (keys for that layout's own mods), and
//      its "enabled" and "hints" props (a layout can ship whistle switched off)
//   3. ~/.config/herdr-app/whistle.json: yours, { enabled, hints, bar, keys, map }; nothing
//      replaces it
// A key set to null in a later layer takes that key away; a group's map merges key by key.
// "keys" (whistle's own keys in WHISTLE, action -> keys) merges action by action: a later
// layer's list replaces the one before, null removes the action.

import { readTextFile, writeTextFile, appHome } from "herdr";

export const USER_FILE = () => `${appHome()}/whistle.json`;
const DEFAULTS_FILE = () => `${appHome()}/mods/whistle/mappings.json`;

// Whistle's own keys, in the order its settings list them: what each does (kind, and dir for
// the moves) and its label.
export const ACTIONS = {
  "field-left": { kind: "field", dir: "left", label: "Field to the left" },
  "field-down": { kind: "field", dir: "down", label: "Field below" },
  "field-up": { kind: "field", dir: "up", label: "Field above" },
  "field-right": { kind: "field", dir: "right", label: "Field to the right" },
  left: { kind: "move", dir: "left", label: "Move left in the field" },
  down: { kind: "move", dir: "down", label: "Move down in the field" },
  up: { kind: "move", dir: "up", label: "Move up in the field" },
  right: { kind: "move", dir: "right", label: "Move right in the field" },
  open: { kind: "open", label: "Open (in a terminal: type there)" },
  type: { kind: "type", label: "Back to TYPE" },
  cancel: { kind: "cancel", label: "Cancel a key sequence" },
  back: { kind: "back", label: "Back one level in a sequence" },
};

// The "keys" layers, action by action: a later layer's list replaces the one before, null
// removes the action, unknown actions are dropped.
function mergeKeys(...layers) {
  const out = {};
  for (const layer of layers) for (const [action, keys] of Object.entries(layer ?? {})) {
    if (keys === null) delete out[action];
    else if (Array.isArray(keys) && ACTIONS[action]) out[action] = keys.map(String);
  }
  return out;
}

// Each own key's action: key -> { action, kind, dir }.
function ownIndex(keys) {
  return new Map(Object.entries(keys).flatMap(([action, ks]) => ks.map((k) => [k, { action, ...ACTIONS[action] }])));
}

export const isGroup = (v) => Boolean(v) && !Array.isArray(v) && typeof v === "object" && Boolean(v.map);

export function merge(base, over) {
  const out = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(over ?? {})) {
    if (v === null) delete out[k];
    else if (isGroup(v) && isGroup(out[k])) out[k] = { ...out[k], ...v, map: merge(out[k].map, v.map) };
    else out[k] = v;
  }
  return out;
}

// The parsed layers (mappings.json, the layout's map and props, whistle.json; any may be
// null) as one config: { map, keys, own, enabled, hints, bar }. Pure, so tests can build one.
export function compose(base, layoutMap, layoutProps, user) {
  const keys = mergeKeys(base?.keys, layoutProps?.keys, user?.keys);
  const pick = (k) => (user && k in user ? user[k] : layoutProps?.[k] != null ? layoutProps[k] : base?.[k]);
  return {
    map: merge(merge(base?.map, layoutMap), user?.map),
    keys,
    own: ownIndex(keys),
    enabled: pick("enabled") !== false,
    hints: pick("hints") !== false,
    bar: typeof user?.bar === "string" ? user.bar : null,
  };
}

// { map, keys, own, enabled, hints, bar, error, userText }: the files read, then composed;
// error names the first file that didn't parse.
export async function load(layoutMap, layoutProps) {
  const errors = [];
  const parse = (text, name) => {
    if (text == null) return null;
    try { return JSON.parse(text); } catch (e) { errors.push(`${name}: ${String(e?.message ?? e).slice(0, 60)}`); return null; }
  };
  const baseText = await readTextFile(DEFAULTS_FILE());
  if (baseText == null) errors.push("whistle/mappings.json is missing");
  const base = parse(baseText, "mappings.json");
  const userText = await readTextFile(USER_FILE());
  const user = parse(userText, "whistle.json");
  return { ...compose(base, layoutMap, layoutProps, user), error: errors[0] ?? null, userText };
}

// Sets one of your settings ("enabled", "hints", "bar") in whistle.json, the rest as you wrote it.
export async function setUser(key, value) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await readTextFile(USER_FILE());
    // The key's value as written: true, false, null or a string.
    const re = new RegExp(`("${key}"\\s*:\\s*)(true|false|null|"(?:[^"\\\\]|\\\\.)*")`);
    const v = JSON.stringify(value);
    const next = raw == null || !/\S/.test(raw.replace(/^\s*\{\s*\}\s*$/, ""))
      ? `${JSON.stringify({ [key]: value, map: {} }, null, 2)}\n`
      : re.test(raw) ? raw.replace(re, (_m, head) => head + v) : raw.replace("{", `{\n  "${key}": ${v},`);
    try { await writeTextFile(USER_FILE(), next, raw); return true; } catch {}
  }
  return false;
}

// The map as rows, groups depth first: [{ seq: ["w", "v"], action, group }].
export function flatten(map, path = [], group = "") {
  return Object.entries(map ?? {}).flatMap(([key, v]) => {
    if (Array.isArray(v)) return [{ seq: [...path, key], action: String(v[0] ?? v[1] ?? ""), group }];
    if (isGroup(v)) return flatten(v.map, [...path, key], v.name ?? key);
    return [];
  });
}
