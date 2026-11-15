// The views' models (ADR 0011): what the hints and settings draw, worked out from the core's
// model. Pure: the views (hints.js, settings.js) only draw what these return.

import { isGroup, ACTIONS, USER, LAYOUT } from "./config.js";
import { keyLabel, canonicalKey } from "./keynames.js";

// A problem in a mod's offered mappings (listed under the mod's name, issue #10).
const fromMod = (model) => {
  const mods = new Set((model.mods ?? []).map((m) => m.name));
  return (p) => mods.has(p.source);
};

// Every config problem, for settings and the bar's marker: [{ source, detail }], whistle's
// config first, then the keynav fields', then keys.json's. Problems in mods' offered mappings aren't config problems:
// settings list them under each mod, and the marker doesn't count them.
export function problems(model) {
  const mod = fromMod(model);
  return [...(model.problems ?? []).filter((p) => !mod(p)), ...(model.fieldProblems ?? []), ...(model.claimProblem ? [{ source: "keys.json", detail: model.claimProblem }] : [])];
}

const seqLabel = (seq) => seq.map(keyLabel).join(" ");

// The hints' model while a key sequence has reached a group in WHISTLE and hints are on (the
// layout's whistle block, whistle.json), else null:
// { keys: the sequence so far ("w m"), title: the group's name, items: [{ key, label, group }]
//   in the group's order, exit: what ends it ("Esc cancels") | null, place: the layout's
//   hintsInset / hintsBorder / hintsLift, for docking the box on the bar }.
export function hints(model, _world) {
  if (model.mode !== "whistle" || !model.sequence?.length || model.config?.hints === false) return null;
  let group = null, map = model.config?.map ?? {};
  for (const k of model.sequence) {
    group = isGroup(map[k]) ? map[k] : null;
    if (!group) return null;
    map = group.map;
  }
  const items = Object.entries(map).map(([key, v]) => (isGroup(v)
    ? { key: keyLabel(key), label: v.name ?? key, group: true }
    : { key: keyLabel(key), label: v.label, group: false }));
  const cancel = model.config?.keys?.cancel?.[0];
  return { keys: seqLabel(model.sequence), title: group.name ?? "", items, exit: cancel ? `${keyLabel(cancel)} cancels` : null,
    place: model.config?.place ?? {} };
}

const names = (mods) => (mods.length > 1 ? `${mods.slice(0, -1).join(", ")} and ${mods.at(-1)}` : mods[0] ?? "");
// Who wrote an override, as settings name it.
const WHO = { [USER]: "you", [LAYOUT]: "the layout" };

// What a mod offers at a key sequence, as it wrote it (its keys in any spelling), or undefined.
function offered(world, mod, seq) {
  let map = world.modMappings?.[mod]?.map;
  let v;
  for (const k of seq) {
    if (!map || typeof map !== "object") return undefined;
    const written = Object.keys(map).find((w) => canonicalKey(w, world.platform ?? null) === k);
    v = written === undefined ? undefined : map[written];
    map = v?.map;
  }
  return v;
}

// A mapping conflict as settings show it (ADR 0008): { keys, seq, mods, own: the own key's
// action | null, text, keep: each mod's mapping there as written [{ mod, value }], for "keep
// <mod>'s" }.
function conflict(c, world) {
  const keys = seqLabel(c.seq);
  const own = c.own ? ACTIONS[c.own]?.label ?? c.own : null;
  const text = own ? `${names(c.mods)} ${c.mods.length > 1 ? "want" : "wants"} ${keys}, whistle's own key for ${own}`
    : `${names(c.mods)} both want ${keys}`;
  const keep = c.mods.map((mod) => ({ mod, value: offered(world, mod, c.seq) })).filter((k) => k.value !== undefined);
  return { keys, seq: c.seq, mods: c.mods, own, text, keep };
}

// A key a later layer maps over a mod's, labelled: { keys, seq, by: its source, over: mods, text }.
function override(o) {
  const keys = seqLabel(o.seq);
  return { keys, seq: o.seq, by: o.source, over: o.over, text: `${keys}: ${WHO[o.source] ?? o.source}, over ${names(o.over)}` };
}

// The settings' model: { problems: config problems [{ source, detail }], conflicts: mapping
// conflicts, overrides: keys mapped over mods', mods: the shown layout's mods that offer
// mappings [{ name, on, problems: details }] }.
export function settings(model, world) {
  const all = model.problems ?? [];
  return {
    problems: problems(model),
    mods: (model.mods ?? []).map((m) => ({ ...m, problems: all.filter((p) => p.source === m.name).map((p) => p.detail) })),
    conflicts: (model.conflicts ?? []).map((c) => conflict(c, world)),
    overrides: (model.overrides ?? []).map(override),
  };
}
