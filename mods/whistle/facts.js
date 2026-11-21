// The facts whistle publishes beside its state (ADR 0006): the hint items (whistle.hints) and the
// config (whistle.config), worked out from the core's model. Pure. Clients decide how to show
// them; nothing here is about looks.

import { isGroup, groupAt, ACTIONS, USER, LAYOUT, KEYS } from "./config.js";
import { keyLabel, canonicalKey } from "./keynames.js";
import { fieldAt, declaredKeys, KEYNAV } from "./fields.js";

// A problem in a mod's offered mappings (listed under the mod's name, issue #10).
const fromMod = (model) => {
  const mods = new Set((model.mods ?? []).map((m) => m.name));
  return (p) => mods.has(p.source);
};

// Every config problem: [{ source, detail }], whistle's config first, then the keynav fields',
// then keys.json's. Problems in mods' offered mappings aren't config problems: config lists them
// under each mod.
export function problems(model) {
  const mod = fromMod(model);
  return [...(model.problems ?? []).filter((p) => !mod(p)), ...(model.fieldProblems ?? []), ...(model.claimProblem ? [{ source: KEYS, detail: model.claimProblem }] : [])];
}

const seqLabel = (seq) => seq.map(keyLabel).join(" ");

// The hint items in WHISTLE (the public whistle.hints, without its v), else null. While a key
// sequence has reached a group, its keys:
// { keys: the sequence so far ("w m"), title: the group's name, items: [{ key, label, group }]
//   in the group's order, exit: what ends it ("Esc cancels") | null }.
// Outside a sequence, the selected keynav field's declared keys (ADR 0013), if it has any that
// count: { keys: "", title: the field's label, items: [{ key, label: the field's, group: false }],
// exit: null }.
export function hints(model, world) {
  if (model.mode !== "whistle") return null;
  if (!model.sequence?.length) return declaredHints(model, world);
  const group = groupAt(model.config?.map, model.sequence);
  if (!group) return null;
  const items = Object.entries(group.map).map(([key, v]) => (isGroup(v)
    ? { key: keyLabel(key), label: v.name ?? key, group: true }
    : { key: keyLabel(key), label: v.label, group: false }));
  const cancel = model.config?.keys?.cancel?.[0];
  return { keys: seqLabel(model.sequence), title: group.name ?? "", items, exit: cancel ? `${keyLabel(cancel)} cancels` : null };
}

function declaredHints(model, world) {
  const field = world?.shared ? fieldAt(world.layout, model.field, model.recent, world.shared) : null;
  if (field?.kind !== KEYNAV) return null;
  const declared = declaredKeys(field, model.config?.own, world.platform ?? null).keys;
  const items = Object.entries(declared).map(([key, written]) => {
    const label = field.keys[written];
    return { key: keyLabel(key), label: typeof label === "string" ? label : written, group: false };
  });
  return items.length ? { keys: "", title: field.label, items, exit: null } : null;
}

const names = (mods) => (mods.length > 1 ? `${mods.slice(0, -1).join(", ")} and ${mods.at(-1)}` : mods[0] ?? "");
// Who wrote an override, as its text names it.
const WHO = { [USER]: "you", [LAYOUT]: "the layout" };

// What a mod offers at a key sequence, as it wrote it (its keys in any spelling), or undefined.
export function offered(world, mod, seq) {
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

// A mapping conflict as whistle.config gives it (ADR 0012): { keys, seq, mods, own: the own
// key's action | null, text, keep: each mod's mapping there as written [{ mod, value }], for
// whistle.keep-mapping }.
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

// whistle.config without its v: { problems: config problems [{ source, detail }], conflicts:
// mapping conflicts, overrides: keys mapped over mods', mods: the shown layout's mods that offer
// mappings [{ name, on, problems: details }] }.
export function config(model, world) {
  const all = model.problems ?? [];
  return {
    problems: problems(model),
    mods: (model.mods ?? []).map((m) => ({ ...m, problems: all.filter((p) => p.source === m.name).map((p) => p.detail) })),
    conflicts: (model.conflicts ?? []).map((c) => conflict(c, world)),
    overrides: (model.overrides ?? []).map(override),
  };
}
