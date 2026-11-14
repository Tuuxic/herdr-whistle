// Fields: the parts of the window whistle can select in WHISTLE, found in the layout, and the
// field in a direction. Pure: it reads only the layout it is given (world.layout).
//
// A field is { block, kind, label }. For now the terminal is the only kind: each block that
// shows a pane is one. Keynav and stock fields join here as later kinds.

export const TERMINAL = "terminal";

// One look at the layout: each node by id and each node's parent.
function index(layout) {
  const nodes = new Map(), parent = new Map();
  const walk = (n, p) => {
    if (!n) return;
    if (n.id) nodes.set(n.id, n);
    parent.set(n, p);
    for (const c of n.children ?? []) walk(c, n);
  };
  walk(layout, null);
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
function list(idx) {
  const out = [];
  for (const [id, n] of idx.nodes) {
    if (n.content?.pane && shows(idx, id)) out.push({ block: id, kind: TERMINAL, label: "Terminal" });
  }
  return out;
}

export const fields = (layout) => list(index(layout));

// Of several fields, the one used last (recent: block ids, the last first), else a terminal,
// else the first.
function pick(all, recent) {
  for (const b of recent ?? []) { const f = all.find((x) => x.block === b); if (f) return f; }
  return all.find((f) => f.kind === TERMINAL) ?? all[0] ?? null;
}

// The field a block names: the block itself, or the field to enter in a group of blocks (a
// stack, a column); null if none shows.
export function fieldAt(layout, block, recent) {
  if (!block) return null;
  const idx = index(layout);
  const all = list(idx);
  const node = idx.nodes.get(block);
  return all.find((f) => f.block === block)
    ?? (node ? pick(all.filter((f) => inside(idx, node, f.block)), recent) : null);
}

// The terminal to fall back on: the one used last, else the first.
export const terminal = (layout, recent) => pick(fields(layout).filter((f) => f.kind === TERMINAL), recent);

// The field in a direction ("left", "down", "up", "right") from the block `from`: the
// layout's rows and columns, entering a group at the field used last. nav (the whistle block's
// prop, { "<block id>": { "<direction>": "<block id>" } }) goes over that for `from` and the
// groups around it, the nearest first; a block it names with no field showing is no move.
export function neighbour(layout, from, dir, recent, nav = {}) {
  const idx = index(layout);
  const all = list(idx);
  for (let n = idx.nodes.get(from); n; n = idx.parent.get(n)) {
    const to = n.id && nav[n.id]?.[dir];
    if (to) return fieldAt(layout, to, recent);
  }
  const axis = dir === "left" || dir === "right" ? "row" : "column";
  const d = dir === "right" || dir === "down" ? 1 : -1;
  for (let n = idx.nodes.get(from); n; n = idx.parent.get(n)) {
    const p = idx.parent.get(n);
    if (p?.type !== axis) continue;
    const row = kids(p);
    for (let i = row.indexOf(n) + d; i >= 0 && i < row.length; i += d) {
      const there = all.filter((f) => inside(idx, row[i], f.block));
      if (there.length) return pick(there, recent);
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
  pick(fields(layout).filter((f) => f.kind === TERMINAL && !within(layout, away, f.block)), recent);
