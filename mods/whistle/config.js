// Whistle's config (ADR 0004, ADR 0007): the config layers, each over the one before:
//   1. the defaults: mappings.json in whistle's folder (an update replaces it)
//   2. the layout's whistle block: its "mappings" and "keys" props
//   3. whistle.json in Herdr's home: the person's own; nothing replaces it
//   (between 1 and 2: mod mappings, from shared("whistle.mappings"), while each mod is in the layout)
//
// Mods' offers (ADR 0007, ADR 0008) and a "mods" section switching mods off: see compose.
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
export const MODS = "mods";

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

// One entry of a map as written: null | a group (checked, as written) | a mapping
// ({ label, run, args, then }) | a reason it's bad ({ bad }).
function entryOf(v, commands) {
  if (v === null) return null;
  if (isObject(v)) return !isObject(v.map) || (v.name != null && typeof v.name !== "string") ? { bad: "a group should be { name, map }" } : v;
  const m = mapping(v, commands);
  return typeof m === "string" ? { bad: m } : m;
}

// A layer's map over the merged one below: key by key, groups merged, null taking a key away.
// Each mapping keeps its source (ctx.source); ctx.wrote(seq, v, was) hears of every key the
// layer writes, for the mods' conflicts and overrides.
function mergeMap(base, over, ctx, path) {
  const out = { ...base };
  for (const [written, raw] of Object.entries(over)) {
    const at = [...path, written].join(" › ");
    const k = canonicalKey(written, ctx.platform);
    if (!k) { ctx.problem(`map › ${at}: "${written}" isn't a key name`); continue; }
    const v = entryOf(raw, ctx.commands);
    if (v?.bad) { ctx.problem(`map › ${at}: ${v.bad}`); continue; }
    ctx.wrote?.([...path, k], v, out[k]);
    if (v === null) { delete out[k]; continue; }
    if (isGroup(v)) {
      const below = isGroup(out[k]) ? out[k] : { name: written, map: {} };
      out[k] = { name: v.name ?? below.name, map: mergeMap(below.map, v.map, ctx, [...path, k]) };
      continue;
    }
    out[k] = { ...v, source: ctx.source };
  }
  return out;
}

// The mods' offers ([{ name, map }], in layout order) over the merged map below: a key one mod
// offers is added (a group merged into the one below); groups that several mods offer on one
// key merge key by key, titled by the first; any other key two mods offer, or a mod offers on
// an own key (outside a key sequence), is a mapping conflict and counts for neither (ADR 0008).
// Add-only: a mod can't take a key away.
function mergeOffers(base, offers, ctx, path) {
  const out = { ...base };
  const byKey = new Map();
  for (const { name, map } of offers) {
    for (const [written, raw] of Object.entries(map)) {
      const problem = (d) => ctx.problem(name, `map › ${[...path, written].join(" › ")}: ${d}`);
      const k = canonicalKey(written, ctx.platform);
      if (!k) { problem(`"${written}" isn't a key name`); continue; }
      const v = entryOf(raw, ctx.commands);
      if (v === null) { problem("a mod can only add keys, not take them away"); continue; }
      if (v.bad) { problem(v.bad); continue; }
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push({ name, written, v: isGroup(v) ? v : { ...v, source: name } });
    }
  }
  for (const [k, list] of byKey) {
    const seq = [...path, k], mods = list.map((x) => x.name);
    const own = path.length ? null : ctx.own[k];
    const groups = list.every((x) => isGroup(x.v));
    if (own) ctx.conflicts.push({ seq, mods, own });
    else if (list.length > 1 && !groups) ctx.conflicts.push({ seq, mods });
    else if (!groups) out[k] = list[0].v;
    else {
      const below = isGroup(out[k]) ? out[k] : { name: list[0].written, map: {} };
      const name = list.find((x) => x.v.name != null)?.v.name ?? below.name;
      out[k] = { name, map: mergeOffers(below.map, list.map((x) => ({ name: x.name, map: x.v.map })), ctx, seq) };
    }
  }
  return out;
}

const startsWith = (seq, prefix) => prefix.length <= seq.length && prefix.every((k, i) => seq[i] === k);
const same = (a, b) => a.length === b.length && startsWith(a, b);

// Which mods are switched off: the layers' "mods" sections (mod -> false: off, true: on), each
// over the one before.
function switches(layers, problem) {
  const on = {};
  layers.forEach((layer, i) => {
    if (layer.source === MODS || layer.mods == null) return;
    if (!isObject(layer.mods)) { problem(i, layer.source, "mods should be an object"); return; }
    for (const [name, v] of Object.entries(layer.mods)) {
      if (typeof v === "boolean") on[name] = v;
      else problem(i, layer.source, `mods › ${name}: should be true or false`);
    }
  });
  return on;
}

// What's wrong with a mod's entry in whistle.mappings ({ v: 1, map }), if anything.
function badEntry(entry) {
  if (!isObject(entry)) return "its entry should be { v: 1, map }";
  if (entry.v !== 1) return `its entry is v ${JSON.stringify(entry.v ?? null)}; whistle reads v 1`;
  if (!isObject(entry.map)) return "its entry's map should be an object";
  return null;
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

// The layers ([{ source, map, keys, mods }], lowest first; map/keys/mods as written, any may be
// missing; the mods layer is { source: MODS, offers: [{ name, entry }] }, in layout order) as
// one config: { map, keys: action -> keys, own: key -> action, problems,
//   conflicts: mapping conflicts, for settings [{ seq, mods, own?: the own key's action }],
//   overrides: keys a later layer maps over a mod's, or over a conflict [{ seq, source, over: mods }] }.
// ctx: { commands: Herdr's command list | null, platform }.
export function compose(layers, { commands = null, platform = null } = {}) {
  // Problems are listed layer by layer, each layer's map before its keys and mods.
  const found = [];
  const note = (i, part) => (source, detail) => found.push({ i, part, source, detail });
  const at = (i, part, source) => ({ commands, platform, source, problem: (detail) => note(i, part)(source, detail) });
  // Own keys first: the mods' keys are checked against them, whichever layer sets them.
  let keys = {};
  layers.forEach((layer, i) => {
    if (layer.source === MODS || layer.keys == null) return;
    if (isObject(layer.keys)) keys = mergeKeys(keys, layer.keys, at(i, 1, layer.source));
    else at(i, 1, layer.source).problem("keys should be an object");
  });
  const own = {};
  for (const [action, ks] of Object.entries(keys)) for (const k of ks) own[k] ??= action;
  const on = switches(layers, (i, source, detail) => note(i, 2)(source, detail));

  let map = {};
  const conflicts = [], overrides = [], mods = new Set();
  layers.forEach((layer, i) => {
    if (layer.source === MODS) {
      const offers = [];
      for (const { name, entry } of layer.offers ?? []) {
        if (on[name] === false) continue;
        const why = badEntry(entry);
        if (why) { note(i, 0)(name, why); continue; }
        mods.add(name);
        offers.push({ name, map: entry.map });
      }
      map = mergeOffers(map, offers, { commands, platform, own, conflicts, problem: note(i, 0) }, []);
      return;
    }
    if (layer.map == null) return;
    const ctx = at(i, 0, layer.source);
    if (!isObject(layer.map)) { ctx.problem("map should be an object"); return; }
    // A key written at a conflict, or above one unless as a group (which merges), settles it;
    // written over a mod's mapping, it's an override. Either is labelled with the last layer
    // that wrote it.
    ctx.wrote = (seq, v, was) => {
      const covers = (s) => same(s, seq) || (!isGroup(v) && startsWith(s, seq));
      for (const o of overrides) if (covers(o.seq)) o.source = layer.source;
      for (const c of conflicts.filter((x) => covers(x.seq))) {
        overrides.push({ seq: c.seq, source: layer.source, over: c.mods });
        conflicts.splice(conflicts.indexOf(c), 1);
      }
      if (was && !isGroup(was) && mods.has(was.source)) overrides.push({ seq, source: layer.source, over: [was.source] });
    };
    map = mergeMap(map, layer.map, ctx, []);
  });
  const problems = found.sort((a, b) => a.i - b.i || a.part - b.part).map(({ source, detail }) => ({ source, detail }));
  return { map, keys, own, problems, conflicts, overrides };
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
