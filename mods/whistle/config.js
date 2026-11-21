// Whistle's config (ADR 0010, ADR 0011): the config layers, each over the one before:
//   1. the defaults: mappings.json in whistle's folder (an update replaces it)
//   2. the layout's whistle block: its "mappings" and "keys" props
//   3. whistle.json in Herdr's home: the person's own; nothing replaces it
//   (between 1 and 2: mod mappings, from shared("whistle.mappings"), while each mod is in the layout)
//
// Mods' offers (ADR 0011, ADR 0012) and a "mods" section switching mods off: see compose.
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
import { parseCommand } from "./commands.js";

// Whistle's own-key actions, in the order clients list them.
export const ACTIONS = {
  "field-left": { kind: "field", dir: "left", label: "Field to the left" },
  "field-down": { kind: "field", dir: "down", label: "Field below" },
  "field-up": { kind: "field", dir: "up", label: "Field above" },
  "field-right": { kind: "field", dir: "right", label: "Field to the right" },
  left: { kind: "move", dir: "left", label: "Move left in the field" },
  down: { kind: "move", dir: "down", label: "Move down in the field" },
  up: { kind: "move", dir: "up", label: "Move up in the field" },
  right: { kind: "move", dir: "right", label: "Move right in the field" },
  pick: { kind: "pick", label: "Pick (in a terminal: type there)" },
  type: { kind: "type", label: "Back to TYPE" },
  cancel: { kind: "cancel", label: "Cancel a key sequence" },
};

// The own keys built into whistle's code, for when there are no defaults at all (mappings.json
// missing or broken, with no last good version): WHISTLE never traps the keyboard.
export const SAFETY = {
  keys: {
    "field-left": ["ctrl-h"], "field-down": ["ctrl-j"], "field-up": ["ctrl-k"], "field-right": ["ctrl-l"],
    left: ["h", "left"], down: ["j", "down"], up: ["k", "up"], right: ["l", "right"],
    pick: ["enter"], type: ["i"], cancel: ["escape"],
  },
  map: {},
};

export const DEFAULTS = "mappings.json";
export const USER = "whistle.json";
// Herdr's keys.json (in Herdr's home): a problem's source, the file claims write.
export const KEYS = "keys.json";
export const LAYOUT = "layout";
export const MODS = "mods";

export const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

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

// A command as written, "<verb>" or "<verb>:<block>": { verb, block: everything after the
// first colon (ADR 0007) | null }. A Herdr command's "<name>:<arg>" splits the same way.
export function verbAndBlock(written) {
  const colon = written.indexOf(":");
  return colon > 0 ? { verb: written.slice(0, colon), block: written.slice(colon + 1) } : { verb: written, block: null };
}

// A command as written ("pane.split", "space.select:1") with Herdr's command list
// ([{ name, args: [{ name }] }], or null: unknown, so anything goes): { run, args } | null when
// Herdr has no such command. Mods' own commands (<mod>.<command>) aren't listed, so a name
// outside Herdr's namespaces counts.
function command(written, args, commands) {
  const { verb: name, block: arg } = verbAndBlock(written);
  if (!commands) return { run: written, args: args ?? {} };
  const known = commands.find((c) => c.name === name);
  if (!known) {
    const ns = name.split(".")[0];
    const herdrs = name.includes(".") && commands.some((c) => c.name.startsWith(`${ns}.`));
    return herdrs || !name.includes(".") ? null : { run: written, args: args ?? {} };
  }
  const first = known.args?.[0]?.name;
  if (arg !== null && !args && first) return { run: name, args: { [first]: arg } };
  return { run: written, args: args ?? {} };
}

// The verbs: whistle's commands that act on a block ("whistle.field:<block>"), which a mapping
// may also give as args ({ "block": "<block>" }).
export const BLOCK_VERBS = ["field", "focus", "toggle"];
// The verb a jump key may add to keep the mode it was pressed in (ADR 0007).
export const KEEP_MODE = "toggle-keep-mode";
// The verbs a jump key (keys.json "whistle.<verb>:<block>") may run.
export const JUMP_VERBS = [...BLOCK_VERBS, KEEP_MODE];
// The block verb a jump verb runs: toggle-keep-mode runs as toggle.
export const runsAs = (verb) => (verb === KEEP_MODE ? "toggle" : verb);

// A whistle.<command> mapping's command as written: { run: "whistle.<verb>", args: { block } }
// for a verb, { run: as written, args: {} } for any other command (parseCommand) | a reason
// it's bad.
function whistleCommand(written, args) {
  const { verb: name, block: arg } = verbAndBlock(written);
  const v = name.slice("whistle.".length);
  if (JUMP_VERBS.includes(v)) {
    const block = arg ?? args?.block;
    if (typeof block !== "string" || !block) return `${name} needs a block: ${name}:<block>`;
    return { run: `whistle.${runsAs(v)}`, args: { block } };
  }
  return parseCommand(written.slice("whistle.".length)) ? { run: written, args: {} } : `unknown whistle command ${written}`;
}

// What's wrong with keys.json's lines that run this copy's commands (<folder>.<command>), as
// config problems: a command whistle doesn't answer to, such as a jump key with an unknown verb
// (ADR 0007). A block the layout lacks is not one (pressed, it flashes). A keys.json that
// doesn't parse is the claims' problem, not listed here.
// Also a switch key in global that names another folder's switch command while none names this
// copy's: Herdr hands an action to the mod its prefix names, so a renamed copy (mods/whistle-2/)
// never gets "whistle.switch-mode" (issue #35). Whistle only reads global; it never writes it.
export function keysProblems(text, folder) {
  let all;
  try { all = JSON.parse(text ?? "null"); } catch { return []; }
  if (!isObject(all)) return [];
  const out = [];
  const global = isObject(all.global) ? Object.entries(all.global) : [];
  if (!global.some(([, a]) => a === `${folder}.switch-mode`)) {
    for (const [key, action] of global) {
      if (typeof action !== "string" || !/^[^.]+\.switch-mode$/.test(action)) continue;
      out.push({ source: KEYS, detail: `global › ${key} runs ${action}, but this copy is ${folder}: make it ${folder}.switch-mode` });
    }
  }
  for (const [section, keys] of Object.entries(all)) {
    if (!isObject(keys)) continue;
    for (const [key, action] of Object.entries(keys)) {
      if (typeof action !== "string" || !action.startsWith(`${folder}.`)) continue;
      const c = action.slice(folder.length + 1);
      if (c.startsWith("key-") || parseCommand(c)) continue;
      const why = JUMP_VERBS.includes(c) ? `${action} needs a block: ${action}:<block>` : `unknown whistle command ${action}`;
      out.push({ source: KEYS, detail: `${section} › ${key}: ${why}` });
    }
  }
  return out;
}

// One mapping as written: { label, run, args, then } | a reason it's bad.
function mapping(v, commands) {
  if (!Array.isArray(v) || typeof v[0] !== "string" || typeof v[1] !== "string")
    return "should be [label, command] or a group { name, map }";
  if (v[2] != null && !isObject(v[2])) return "its args should be an object";
  if (v[3] != null && v[3] !== "type") return 'its 4th item can only be "type"';
  if (v[1].startsWith("whistle.")) {
    const w = whistleCommand(v[1], v[2]);
    return typeof w === "string" ? w : { label: v[0], ...w, then: v[3] ?? null };
  }
  const c = command(v[1], v[2], commands);
  if (!c) return `unknown command ${v[1]}`;
  return { label: v[0], ...c, then: v[3] ?? null };
}

export const isGroup = (v) => isObject(v) && isObject(v.map) && !("run" in v);

// The group a key sequence reaches in a map, or null when it doesn't reach one (no sequence: the
// map itself, as { map }).
export function groupAt(map, seq) {
  let group = { map: map ?? {} };
  for (const k of seq ?? []) {
    group = isGroup(group.map[k]) ? group.map[k] : null;
    if (!group) return null;
  }
  return group;
}

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
// an own key (outside a key sequence), is a mapping conflict and counts for neither (ADR 0012).
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

// The mods with a mapping somewhere in a group (of those in `mods`), in the order they come.
function modsIn(group, mods) {
  const out = [];
  const walk = (map) => {
    for (const v of Object.values(map)) {
      if (isGroup(v)) walk(v.map);
      else if (mods.has(v.source) && !out.includes(v.source)) out.push(v.source);
    }
  };
  walk(group.map);
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
//   conflicts: mapping conflicts, for whistle.config [{ seq, mods, own?: the own key's action }],
//   overrides: keys a later layer maps over a mod's (or over a group holding mods' mappings), or
//     over a conflict [{ seq, source, over: mods }],
//   off: the mods switched off (names) }.
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
    // written over a mod's mapping, or over a group with mods' mappings in it (unless as a group,
    // which merges), it's an override. Either is labelled with the last layer that wrote it.
    ctx.wrote = (seq, v, was) => {
      const covers = (s) => same(s, seq) || (!isGroup(v) && startsWith(s, seq));
      for (const o of overrides) if (covers(o.seq)) o.source = layer.source;
      for (const c of conflicts.filter((x) => covers(x.seq))) {
        overrides.push({ seq: c.seq, source: layer.source, over: c.mods });
        conflicts.splice(conflicts.indexOf(c), 1);
      }
      const over = !was ? [] : !isGroup(was) ? (mods.has(was.source) ? [was.source] : []) : isGroup(v) ? [] : modsIn(was, mods);
      if (over.length) overrides.push({ seq, source: layer.source, over });
    };
    map = mergeMap(map, layer.map, ctx, []);
  });
  const problems = found.sort((a, b) => a.i - b.i || a.part - b.part).map(({ source, detail }) => ({ source, detail }));
  const off = Object.keys(on).filter((name) => on[name] === false);
  return { map, keys, own, problems, conflicts, overrides, off };
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

// whistle.json's text (null: no file) with a mod switched on or off in its "mods" section, for
// whistle.mappings-on and -off to write: { text } | { problem } (a whistle.json that doesn't read is left alone).
export function switchMod(text, name, on) {
  return edit(text, (json) => {
    if (json.mods != null && !isObject(json.mods)) return "whistle.json's mods isn't an object: fix it first";
    json.mods = { ...(json.mods ?? {}), [name]: on };
    return null;
  });
}

// whistle.json's text (null: no file) with a mod's mapping (as the mod wrote it) at the key
// sequence seq, for whistle.keep-mapping: { text } | { problem }. Groups on the way that
// whistle.json doesn't have yet are added (no name: the one below keeps its title).
export function keepMapping(text, seq, value) {
  return edit(text, (json) => {
    if (json.map != null && !isObject(json.map)) return "whistle.json's map isn't an object: fix it first";
    json.map = { ...(json.map ?? {}) };
    let map = json.map;
    for (const k of seq.slice(0, -1)) {
      map[k] = isGroup(map[k]) ? { ...map[k], map: { ...map[k].map } } : { map: {} };
      map = map[k].map;
    }
    map[seq.at(-1)] = value;
    return null;
  });
}

// whistle.json's text changed by change(json) (which may say why it can't): { text } | { problem }.
function edit(text, change) {
  let json = {};
  if (text != null) {
    try { json = JSON.parse(text); } catch { return { problem: `${USER} doesn't parse: fix it first` }; }
    if (!isObject(json)) return { problem: `${USER} isn't a JSON object: fix it first` };
  }
  const problem = change(json);
  return problem ? { problem } : { text: `${JSON.stringify(json, null, 2)}\n` };
}
