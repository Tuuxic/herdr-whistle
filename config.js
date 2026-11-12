// Whistle's settings and mappings, in three layers, each over the one before:
//   1. mappings.json in this folder: the defaults, Herdr's own commands only (an update
//      replaces this file, so don't edit it)
//   2. the layout: the whistle block's "mappings" prop (keys for that layout's own mods), and
//      its "enabled" and "hints" props (a layout can ship whistle switched off)
//   3. ~/.config/herdr-app/whistle.json: yours, { enabled, hints, map }; nothing replaces it
// A key set to null in a later layer takes that key away; a group's map merges key by key.

import { readTextFile, writeTextFile, appHome } from "herdr";

export const USER_FILE = () => `${appHome()}/whistle.json`;
const DEFAULTS_FILE = () => `${appHome()}/mods/whistle/mappings.json`;

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
    enabled: pick("enabled") !== false,
    hints: pick("hints") !== false,
    error: errors[0] ?? null,
    userText,
  };
}

// Sets one of your settings ("enabled", "hints") in whistle.json, the rest as you wrote it.
export async function setUser(key, value) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await readTextFile(USER_FILE());
    const re = new RegExp(`("${key}"\\s*:\\s*)(true|false|null)`);
    const next = raw == null || !/\S/.test(raw.replace(/^\s*\{\s*\}\s*$/, ""))
      ? `${JSON.stringify({ [key]: value, map: {} }, null, 2)}\n`
      : re.test(raw) ? raw.replace(re, `$1${value}`) : raw.replace("{", `{\n  "${key}": ${value},`);
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
