// Fields: the parts of the window whistle can select in WHISTLE, found in the layout, and the
// field in a direction. Pure: it reads only the layout it is given (world.layout).
//
// A field is { block, kind, label, stock? }. Kinds: the terminal (each block that shows a
// pane) and stock fields (a block of one of Herdr's own spaces, tabs or agents mods, ADR 0006).
// Keynav fields join here as a later kind.

export const TERMINAL = "terminal";
export const STOCK = "stock";

// The stock fields: Herdr's own mods, each to the Herdr commands its moves run (ADR 0006).
// This is the one place whistle names a mod, and only Herdr's own; no config adds to it. A
// direction left out does nothing. `open: "terminal"`: open (and the move into the item's
// content, `right`) goes on to the terminal field; otherwise open stays (the item is already
// shown). The files block is not a field: Herdr gives it no commands.
export const STOCK_FIELDS = {
  spaces: { label: "Spaces", down: "space.next", up: "space.prev" },
  tabs: { label: "Tabs", right: "tab.next", left: "tab.prev" },
  agents: { label: "Agents", down: "agent.next", up: "agent.prev", open: "terminal" },
};

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
    if (!shows(idx, id)) continue;
    if (n.content?.pane) out.push({ block: id, kind: TERMINAL, label: "Terminal" });
    else if (Object.hasOwn(STOCK_FIELDS, n.content?.mod ?? ""))
      out.push({ block: id, kind: STOCK, stock: n.content.mod, label: STOCK_FIELDS[n.content.mod].label });
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
// layout's rows and columns, entering a group at the field used last.
export function neighbour(layout, from, dir, recent) {
  const idx = index(layout);
  const all = list(idx);
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
