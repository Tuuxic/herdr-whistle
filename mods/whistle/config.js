// Whistle's config (ADR 0004, ADR 0007): the config layers, each over the one before:
//   1. the defaults: mappings.json in whistle's folder (an update replaces it)
//   2. the layout's whistle block: its "mappings" and "keys" props
//   3. whistle.json in Herdr's home: the person's own; nothing replaces it
// (Mod mappings join as a layer between 1 and 2 in a later slice.)
//
// Two sections, apart: "map" (mappings: key -> [label, command, args?, "type"?], or a group
// { name, map } whose keys follow) and "keys" (own keys: action -> list of keys). A key set to
// null in a later layer takes it away; groups merge key by key; an action's list replaces the
// one before, null removes the action.
//
// Pure: the shell reads the files, and step keeps each file's last good version (readFile).
// Every entry is checked on load: a bad one is skipped and listed as a config problem, the rest
// of its file still counts.

import { canonicalKey } from "./keynames.js";

// Whistle's own-key actions, in the order settings list them.
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

// The own keys built into whistle's code, for when there are no defaults at all (mappings.json
// missing or broken, with no last good version): WHISTLE never traps the keyboard.
export const SAFETY = {
  keys: {
    "field-left": ["ctrl-h"], "field-down": ["ctrl-j"], "field-up": ["ctrl-k"], "field-right": ["ctrl-l"],
    left: ["h", "left"], down: ["j", "down"], up: ["k", "up"], right: ["l", "right"],
    open: ["enter"], type: ["i"], cancel: ["escape"], back: ["backspace"],
  },
  map: {},
};

export const DEFAULTS = "mappings.json";
export const USER = "whistle.json";
export const LAYOUT = "layout";

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

// One file's text against its last good version (good: { text, json } | null):
// { good, missing } | { good, broken: why } | { good: the new version }. A text of undefined
// is a file not read yet: { good, unread }.
export function readFile(good, text) {
  if (text === undefined) return { good, unread: true };
  if (text === null) return { good, missing: true };
  if (good?.text === text) return { good };
  let json;
  try { json = JSON.parse(text); } catch { return { good, broken: "doesn't parse" }; }
  if (!isObject(json)) return { good, broken: "isn't a JSON object" };
  return { good: { text, json } };
}

// A command as written ("pane.split", "space.select:1") with Herdr's command list
// ([{ name, args: [{ name }] }], or null: unknown, so anything goes): { run, args } | null when
// Herdr has no such command. Mods' own commands (<mod>.<command>) aren't listed, so a name
// outside Herdr's namespaces counts.
function command(written, args, commands) {
  const colon = written.indexOf(":");
  const name = colon > 0 ? written.slice(0, colon) : written;
  if (!commands) return { run: written, args: args ?? {} };
  const known = commands.find((c) => c.name === name);
  if (!known) {
    const ns = name.split(".")[0];
    const herdrs = name.includes(".") && commands.some((c) => c.name.startsWith(`${ns}.`));
    return herdrs || !name.includes(".") ? null : { run: written, args: args ?? {} };
  }
  const first = known.args?.[0]?.name;
  if (colon > 0 && !args && first) return { run: name, args: { [first]: written.slice(colon + 1) } };
  return { run: written, args: args ?? {} };
}

// One mapping as written: { label, run, args, then } | a reason it's bad.
function mapping(v, commands) {
  if (!Array.isArray(v) || typeof v[0] !== "string" || typeof v[1] !== "string")
    return "should be [label, command] or a group { name, map }";
  if (v[2] != null && !isObject(v[2])) return "its args should be an object";
  if (v[3] != null && v[3] !== "type") return 'its 4th item can only be "type"';
  const c = command(v[1], v[2], commands);
  if (!c) return `unknown command ${v[1]}`;
  return { label: v[0], ...c, then: v[3] ?? null };
}

export const isGroup = (v) => isObject(v) && isObject(v.map) && !("run" in v);

// A layer's map over the merged one below: key by key, groups merged, null taking a key away.
function mergeMap(base, over, ctx, path) {
  const out = { ...base };
  for (const [written, v] of Object.entries(over)) {
    const at = [...path, written].join(" › ");
    const k = canonicalKey(written, ctx.platform);
    if (!k) { ctx.problem(`map › ${at}: "${written}" isn't a key name`); continue; }
    if (v === null) { delete out[k]; continue; }
    if (isObject(v)) {
      if (!isObject(v.map) || (v.name != null && typeof v.name !== "string")) {
        ctx.problem(`map › ${at}: a group should be { name, map }`); continue;
      }
      const below = isGroup(out[k]) ? out[k] : { name: written, map: {} };
      out[k] = { name: v.name ?? below.name, map: mergeMap(below.map, v.map, ctx, [...path, written]) };
      continue;
    }
    const m = mapping(v, ctx.commands);
    if (typeof m === "string") ctx.problem(`map › ${at}: ${m}`);
    else out[k] = m;
  }
  return out;
}

// A layer's own keys over the merged ones below: action by action.
function mergeKeys(base, over, ctx) {
  const out = { ...base };
  for (const [action, v] of Object.entries(over)) {
    if (!ACTIONS[action]) { ctx.problem(`keys › ${action}: unknown action`); continue; }
    if (v === null) { delete out[action]; continue; }
    if (!Array.isArray(v)) { ctx.problem(`keys › ${action}: should be a list of keys`); continue; }
    out[action] = [];
    for (const written of v) {
      const k = canonicalKey(written, ctx.platform);
      if (k) out[action].push(k);
      else ctx.problem(`keys › ${action}: ${JSON.stringify(written)} isn't a key name`);
    }
  }
  return out;
}

// The layers ([{ source, map, keys }], lowest first; map/keys as written, either may be
// missing) as one config: { map, keys: action -> keys, own: key -> action, problems }.
// ctx: { commands: Herdr's command list | null, platform }.
export function compose(layers, { commands = null, platform = null } = {}) {
  const problems = [];
  let map = {}, keys = {};
  for (const layer of layers) {
    const ctx = { commands, platform, problem: (detail) => problems.push({ source: layer.source, detail }) };
    if (layer.map != null) {
      if (isObject(layer.map)) map = mergeMap(map, layer.map, ctx, []);
      else ctx.problem("map should be an object");
    }
    if (layer.keys != null) {
      if (isObject(layer.keys)) keys = mergeKeys(keys, layer.keys, ctx);
      else ctx.problem("keys should be an object");
    }
  }
  const own = {};
  for (const [action, ks] of Object.entries(keys)) for (const k of ks) own[k] ??= action;
  return { map, keys, own, problems };
}

// Every key the config uses: own keys, and mapped keys at every depth.
export function usedKeys(config) {
  const out = new Set(Object.keys(config.own));
  const walk = (map) => {
    for (const [k, v] of Object.entries(map)) { out.add(k); if (isGroup(v)) walk(v.map); }
  };
  walk(config.map);
  return [...out];
}

// The map as rows, groups depth first: [{ seq: ["w", "v"], action, group }].
export function flatten(map, path = [], group = "") {
  return Object.entries(map ?? {}).flatMap(([key, v]) => {
    if (isGroup(v)) return flatten(v.map, [...path, key], v.name ?? key);
    return [{ seq: [...path, key], action: v.run, group }];
  });
}
