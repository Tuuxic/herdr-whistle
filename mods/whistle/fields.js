// Fields: the parts of the window whistle can select in WHISTLE, found in the layout, and the
// field in a direction. Pure: it reads only the layout it is given (world.layout).
//
// A field is { block, kind, label }, plus { stock } for a stock field and { mod, key, keys, v }
// for a keynav field. Kinds:
//   - the terminal: each block that shows a pane;
//   - stock fields: a block of one of Herdr's own spaces, tabs or agents mods (ADR 0006);
//   - keynav (docs/contracts/keynav.md): any other mod's block whose entry
//     shared("keynav.field:<fieldKey>") says v 3, or v 2 (still driven); the field's `v` is
//     its entry's, and decides how whistle speaks to it. `shared` is the shared state the shell read
//     ({ "<shared key>": value }); stale entries for blocks not in the layout never count.

import { canonicalKey, isChord } from "./keynames.js";

export const TERMINAL = "terminal";
export const STOCK = "stock";
export const KEYNAV = "keynav";

// The stock fields: Herdr's own mods, each to the Herdr commands its moves run (ADR 0006).
// This is the one place whistle names a mod, and only Herdr's own; no config adds to it. A
// direction left out does nothing. `pick: "terminal"`: pick (and the move into the item's
// content, `right`) goes on to the terminal field; otherwise pick stays (the item is already
// shown). The files block is not a field: Herdr gives it no commands.
export const STOCK_FIELDS = {
  spaces: { label: "Spaces", down: "space.next", up: "space.prev" },
  tabs: { label: "Tabs", right: "tab.next", left: "tab.prev" },
  agents: { label: "Agents", down: "agent.next", up: "agent.prev", pick: "terminal" },
};

// keynav's newest version (the driver's entry announces it), the versions whistle drives, and
// the shared keys of a field's entry and request slot.
export const KEYNAV_V = 3;
export const KEYNAV_VERSIONS = [2, 3];
// A move as a keynav field of its version reads it: pick was open before v3.
export const moveFor = (field, move) => (move === "pick" && field.v === 2 ? "open" : move);
// What a keynav field's request asks, read as its version writes it: "terminal" | "hold" | null
// (not a request). v3: { after: "terminal" | "hold", at }; v2: { to: "terminal", at } |
// { hold: true, at }.
export function requestOf(field, r) {
  if (!r || typeof r !== "object" || typeof r.at !== "number") return null;
  if (field.v === 2) return r.to === "terminal" ? "terminal" : r.hold === true ? "hold" : null;
  return r.after === "terminal" || r.after === "hold" ? r.after : null;
}
export const entryKey = (key) => `keynav.field:${key}`;
export const requestKey = (key) => `keynav.request:${key}`;

// A field's key: the mod and its props, as text with object keys sorted at every depth (objects
// inside arrays too; arrays keep their order), so the driver and the mod spell the same field
// the same way (keynav.js repeats it).
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
};
export const fieldKey = (mod, props) => `${mod} ${stable(props ?? {})}`;

// A keynav field's entry, if it is in a version this driver speaks: { v, label, keys }.
export function entryOf(shared, key) {
  const e = shared?.[entryKey(key)];
  return e && typeof e === "object" && KEYNAV_VERSIONS.includes(e.v) ? e : null;
}

// Every node of a layout tree, depth first in layout order: visit(node, parent | null, hidden:
// whether the node or a group around it is hidden). The one walk of the layout whistle has.
export function eachNode(layout, visit) {
  const walk = (n, p, hidden) => {
    if (!n) return;
    const h = hidden || Boolean(n.hidden);
    visit(n, p, h);
    for (const c of n.children ?? []) walk(c, n, h);
  };
  walk(layout, null, false);
}

// One look at the layout: each node by id and each node's parent.
function index(layout) {
  const nodes = new Map(), parent = new Map();
  eachNode(layout, (n, p) => {
    if (n.id) nodes.set(n.id, n);
    parent.set(n, p);
  });
  return { nodes, parent };
}

const stackActive = (s) => s.active ?? s.children?.[0]?.id;
// The children that show: not hidden, and only the selected one of a stack.
const kids = (n) => (n.children ?? []).filter((c) => !c.hidden && (n.type !== "stack" || c.id === stackActive(n)));

function shows(idx, id) {
  for (let n = idx.nodes.get(id); n; n = idx.parent.get(n)) {
    const p = idx.parent.get(n);
    if (n.hidden || (p?.type === "stack" && stackActive(p) !== n.id)) return false;
  }
  return Boolean(idx.nodes.get(id));
}

function inside(idx, node, id) {
  for (let n = idx.nodes.get(id); n; n = idx.parent.get(n)) if (n === node) return true;
  return false;
}

// Every field that shows, in layout order.
function list(idx, shared) {
  const out = [];
  for (const [id, n] of idx.nodes) {
    const c = n.content;
    if (!c || !shows(idx, id)) continue;
    if (c.pane) out.push({ block: id, kind: TERMINAL, label: "Terminal" });
    else if (Object.hasOwn(STOCK_FIELDS, c.mod ?? "")) out.push({ block: id, kind: STOCK, stock: c.mod, label: STOCK_FIELDS[c.mod].label });
    else if (c.mod) {
      const key = fieldKey(c.mod, c.props);
      const e = entryOf(shared, key);
      if (e) out.push({ block: id, kind: KEYNAV, label: typeof e.label === "string" ? e.label : c.mod, mod: c.mod, key, keys: e.keys, v: e.v });
    }
  }
  return out;
}

export const fields = (layout, shared) => list(index(layout), shared);

// Every mod's block that shows, keynav field or not: [{ block, mod, key }]. The shell reads
// their entries and request slots from these.
export function modBlocks(layout) {
  const idx = index(layout), out = [];
  for (const [id, n] of idx.nodes) {
    if (n.content?.mod && shows(idx, id)) out.push({ block: id, mod: n.content.mod, key: fieldKey(n.content.mod, n.content.props) });
  }
  return out;
}

// A keynav field's declared keys, against whistle's own keys (own: key -> action):
// { keys: { <canonical key>: <the key as the field wrote it> }, problems: [detail] }. A chord,
// a key that isn't one, or an own key is left out and named in problems.
export function declaredKeys(field, own, platform) {
  const keys = {}, problems = [];
  const decl = field.keys && typeof field.keys === "object" && !Array.isArray(field.keys) ? field.keys : {};
  const who = `${field.label} (${field.mod})`;
  for (const written of Object.keys(decl)) {
    const k = canonicalKey(written, platform);
    if (!k) problems.push(`${who} declares ${written}, which isn't a key`);
    else if (isChord(k)) problems.push(`${who} declares ${written}, a chord; fields declare only keys without Ctrl, Alt or Super`);
    else if (own?.[k]) problems.push(`${who} declares ${written}, one of whistle's own keys; it's ignored`);
    else keys[k] = written;
  }
  return { keys, problems };
}

// Of several fields, the one used last (recent: block ids, the last first), else a terminal,
// else the first.
function preferred(all, recent) {
  for (const b of recent ?? []) { const f = all.find((x) => x.block === b); if (f) return f; }
  return all.find((f) => f.kind === TERMINAL) ?? all[0] ?? null;
}

// The field a block names: the block itself, or the field to enter in a group of blocks (a
// stack, a column); null if none shows.
export function fieldAt(layout, block, recent, shared) {
  if (!block) return null;
  const idx = index(layout);
  const all = list(idx, shared);
  const node = idx.nodes.get(block);
  return all.find((f) => f.block === block)
    ?? (node ? preferred(all.filter((f) => inside(idx, node, f.block)), recent) : null);
}

// The terminal to fall back on: the one used last, else the first.
export const terminal = (layout, recent) => preferred(fields(layout, null).filter((f) => f.kind === TERMINAL), recent);

// The field in a direction ("left", "down", "up", "right") from the block `from`: the
// layout's rows and columns, entering a group at the field used last. nav (the whistle block's
// prop, { "<block id>": { "<direction>": "<block id>" } }) goes over that for `from` and the
// groups around it, the nearest first; a block it names with no field showing is no move.
export function neighbour(layout, from, dir, recent, shared, nav = {}) {
  const idx = index(layout);
  const all = list(idx, shared);
  for (let n = idx.nodes.get(from); n; n = idx.parent.get(n)) {
    const to = n.id && nav?.[n.id]?.[dir];
    if (to) return fieldAt(layout, to, recent, shared);
  }
  const axis = dir === "left" || dir === "right" ? "row" : "column";
  const d = dir === "right" || dir === "down" ? 1 : -1;
  for (let n = idx.nodes.get(from); n; n = idx.parent.get(n)) {
    const p = idx.parent.get(n);
    if (p?.type !== axis) continue;
    const row = kids(p);
    for (let i = row.indexOf(n) + d; i >= 0 && i < row.length; i += d) {
      const there = all.filter((f) => inside(idx, row[i], f.block));
      if (there.length) return preferred(there, recent);
    }
  }
  return null;
}

// Whether the layout has a block with this id, and whether it shows.
export const has = (layout, id) => index(layout).nodes.has(id);
export const showing = (layout, id) => shows(index(layout), id);

// What it takes to show a block: [{ show: id } | { stack, child }], outermost first: each hidden
// node on its way shown, each stack on its way switched to it.
export function reveal(layout, id) {
  const idx = index(layout), out = [];
  for (let n = idx.nodes.get(id); n; n = idx.parent.get(n)) {
    const p = idx.parent.get(n);
    if (n.hidden) out.unshift({ show: n.id });
    if (p?.type === "stack" && stackActive(p) !== n.id) out.unshift({ stack: p.id, child: n.id });
  }
  return out;
}

// The node to hide to take a block away: the block, or the stack or lone-child group it fills
// (so no empty group stays behind), never the layout's root.
export function hideTarget(layout, id) {
  const idx = index(layout);
  let n = idx.nodes.get(id);
  for (let p = idx.parent.get(n); p && idx.parent.get(p) && (p.type === "stack" || kids(p).length <= 1); p = idx.parent.get(n)) n = p;
  return n?.id ?? null;
}

// Whether the block `id` is the node `outer` or inside it.
export function within(layout, outer, id) {
  const idx = index(layout);
  const node = idx.nodes.get(outer);
  return Boolean(node) && inside(idx, node, id);
}

// The terminal to fall back on outside the block `away` (about to go): the one used last, else
// the first.
export const terminalOutside = (layout, away, recent) =>
  preferred(fields(layout, null).filter((f) => f.kind === TERMINAL && !within(layout, away, f.block)), recent);
