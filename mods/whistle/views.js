// The views' models (ADR 0011): what the hints and settings draw, worked out from the core's
// model. Pure: the views (hints.js, settings.js) only draw what these return.

import { isGroup, groupAt, ACTIONS, USER, LAYOUT } from "./config.js";
import { keyLabel, canonicalKey } from "./keynames.js";
import { fieldAt, declaredKeys, KEYNAV } from "./fields.js";

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

// The hints' model in WHISTLE while hints are on (the layout's whistle block, whistle.json),
// else null. While a key sequence has reached a group, its keys:
// { keys: the sequence so far ("w m"), title: the group's name, items: [{ key, label, group }]
//   in the group's order, exit: what ends it ("Esc cancels") | null }.
// Outside a sequence, the selected keynav field's declared keys (ADR 0009), if it has any that
// count: { keys: "", title: the field's label, items: [{ key, label: the field's, group: false }],
// exit: null }.
export function hints(model, world) {
  if (model.mode !== "whistle" || model.config?.hints === false) return null;
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

// The hints window's measures (px): a row, the side padding, the title row, the gap between
// columns, the arrow's width and the gap on each side of it. hints.js draws by them.
export const HINTS_BOX = { ROW: 18, PAD: 12, HEAD: 22, GAP: 32, ARROW: 14, INNER: 8 };
const { ROW, PAD, HEAD, GAP, ARROW, INNER } = HINTS_BOX;
const itemText = (i) => (i.group ? `+${i.label}` : i.label);

// A text's width at the hints' 12 px, estimated on the wide side (whistle can't measure text):
// narrow letters, wide ones (m, w, capitals), the rest. Bold keys run a little wider.
const NARROW = /[il.,:;'|!ftjrI \[\]()]/, WIDE = /[mwMW@%]/, CAPS = /[A-Z0-9+]/;
const charWidth = (c) => (NARROW.test(c) ? 4.5 : WIDE.test(c) ? 11 : CAPS.test(c) ? 9 : 7.5);
const textWidth = (text, bold = false) => Math.ceil([...text].reduce((w, c) => w + charWidth(c), 0) * (bold ? 1.08 : 1));

// One column's widths: its longest key, its longest label (all of it: labels are never cut),
// and the column, key + arrow + label with the gaps between.
export const keyWidth = (col) => Math.max(...col.map((i) => textWidth(i.key, true))) + 4;
export const labelWidth = (col) => Math.max(...col.map((i) => textWidth(itemText(i)))) + 4;
export const columnWidth = (col) => keyWidth(col) + INNER + ARROW + INNER + labelWidth(col);

// The hints' items in columns filled top to bottom, each as wide as its own items: the most
// columns that fit the width. { columns, rows }.
export function hintsColumns(items, width) {
  for (let cols = Math.max(1, items.length); cols >= 1; cols--) {
    const rows = Math.ceil(items.length / cols);
    const columns = Array.from({ length: cols }, (_, c) => items.slice(c * rows, c * rows + rows)).filter((c) => c.length);
    const used = columns.reduce((sum, col) => sum + columnWidth(col), 0) + GAP * (columns.length - 1);
    if (used <= width - 2 * PAD || cols === 1) return { columns, rows: Math.max(1, rows) };
  }
  return { columns: [items], rows: Math.max(1, items.length) };
}

// The bar's height when the shell hasn't measured it (mod.json's size), and the window's width.
const BAR_HEIGHT = 22, WIDTH = 900;

// Where the hints window docks: on top of the bar and as wide as it, { width, height, at? }.
// Whistle measures only the window (world.viewport) and its own bar (world.barSize, inside any
// border); the layout says the rest. The bar block (the bar and a border hintsAlignBorder wide
// around it) ends hintsAlignRight px from the window's right edge, and the box sits hintsGap
// (6) above the block's top, border included. Without a viewport, Herdr places the window.
export function hintsBox(items, place, world) {
  const vp = world.viewport ?? null;
  const right = place.hintsAlignRight ?? 0, border = place.hintsAlignBorder ?? 0, gap = place.hintsGap ?? 6;
  const barWidth = world.barSize?.width ?? vp?.width ?? WIDTH;
  const width = Math.round(barWidth + 2 * border);
  const height = HEAD + hintsColumns(items, width).rows * ROW + 10;
  if (!vp) return { width, height };
  const blockHeight = (world.barSize?.height ?? BAR_HEIGHT) + 2 * border;
  const at = { x: Math.max(0, vp.width - right - width), y: Math.max(8, vp.height - blockHeight - height - gap) };
  return { width, height, at };
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
