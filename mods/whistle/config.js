// Whistle's settings and mappings, in three layers, each over the one before:
//   1. mappings.json in this folder: the defaults, Herdr's own commands only (an update
//      replaces this file, so don't edit it)
//   2. the layout: the whistle block's "mappings" prop (keys for that layout's own mods), and
//      its "enabled" and "hints" props (a layout can ship whistle switched off)
//   3. ~/.config/herdr-app/whistle.json: yours, { enabled, hints, map }; nothing replaces it
// A key set to null in a later layer takes that key away; a group's map merges key by key.
// "keys" (whistle's own keys in WHISTLE, action -> keys) merges action by action: a later
// layer's list replaces the one before, null removes the action.

import { readTextFile, writeTextFile, appHome } from "herdr";

export const USER_FILE = () => `${appHome()}/whistle.json`;
const DEFAULTS_FILE = () => `${appHome()}/mods/whistle/mappings.json`;
const KEYS_FILE = () => `${appHome()}/keys.json`;

// Whistle's own keys, in the order its settings list them.
export const ACTIONS = {
  "field-left": "Field to the left", "field-down": "Field below", "field-up": "Field above", "field-right": "Field to the right",
  left: "Move left in the field", down: "Move down in the field", up: "Move up in the field", right: "Move right in the field",
  open: "Open (in a terminal: type there)", type: "Back to TYPE",
  cancel: "Cancel a key sequence", back: "Back one level in a sequence",
};

function mergeKeys(...layers) {
  const out = {};
  for (const layer of layers) for (const [action, keys] of Object.entries(layer ?? {})) {
    if (keys === null) delete out[action];
    else if (Array.isArray(keys)) out[action] = keys.map(String);
  }
  return out;
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

// { map, enabled, hints, error, userText }; error names the first file that didn't parse.
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
  const pick = (k) => (user && k in user ? user[k] : layoutProps?.[k] != null ? layoutProps[k] : base?.[k]);
  return {
    map: merge(merge(base?.map, layoutMap), user?.map),
    keys: mergeKeys(base?.keys, layoutProps?.keys, user?.keys),
    enabled: pick("enabled") !== false,
    hints: pick("hints") !== false,
    bar: typeof user?.bar === "string" ? user.bar : null,
    error: errors[0] ?? null,
    userText,
  };
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

// Chords (ctrl-/alt-/super- keys) in WHISTLE: keys.json's sections run before whistle sees a key,
// so whistle claims its chords in keys.json's "mod:whistle" section, each sent back to it as
// whistle.key-<chord>. Whistle owns only those entries (and the whistle.left/down/up/right ones
// it shipped before); your own entries there stay as you wrote them and win.
const isChord = (k) => /^(ctrl|alt|super)-./.test(k);
const OWNED = /^whistle\.(key-.+|left|down|up|right)$/;

function chordsOf(conf) {
  const out = new Set(Object.values(conf?.keys ?? {}).flat().filter(isChord));
  const walk = (map) => { for (const [k, v] of Object.entries(map ?? {})) { if (isChord(k)) out.add(k); if (isGroup(v)) walk(v.map); } };
  walk(conf?.map);
  return out;
}

export async function syncKeys(conf) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await readTextFile(KEYS_FILE());
    if (raw == null) return; // no keys.json: Herdr's defaults; writing one would replace them
    let all;
    try { all = JSON.parse(raw); } catch { return; }
    const was = all["mod:whistle"] ?? {}, want = chordsOf(conf), next = {};
    for (const [k, v] of Object.entries(was)) if (!(typeof v === "string" && OWNED.test(v)) || (want.has(k) && v === `whistle.key-${k}`)) next[k] = v;
    for (const k of want) if (!(k in next)) next[k] = `whistle.key-${k}`;
    if (JSON.stringify(next) === JSON.stringify(was)) return;
    all["mod:whistle"] = next;
    try { await writeTextFile(KEYS_FILE(), `${JSON.stringify(all, null, 2)}\n`, raw); return; } catch {}
  }
}

// The key keys.json binds to command: the first of sections that has one, else null.
export async function boundKey(command, sections) {
  let all;
  try { all = JSON.parse((await readTextFile(KEYS_FILE())) ?? "{}"); } catch { return null; }
  for (const s of sections) for (const [k, v] of Object.entries(all[s] ?? {})) if (v === command) return k;
  return null;
}
