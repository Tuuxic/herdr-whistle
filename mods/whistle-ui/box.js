// The hints box's measures and where it goes, pure: hints.js draws by these, ui.js docks the box
// with hintsBox.

// The box's measures (px): a row, the side padding, the title row, the gap between columns, the
// arrow's width and the gap on each side of it.
export const HINTS_BOX = { ROW: 18, PAD: 12, HEAD: 22, GAP: 32, ARROW: 14, INNER: 8 };
const { ROW, PAD, HEAD, GAP, ARROW, INNER } = HINTS_BOX;
const itemText = (i) => (i.group ? `+${i.label}` : i.label);

// A text's width at the hints' 12 px, estimated on the wide side (a mod can't measure text):
// narrow letters, wide ones (m, w, capitals), the rest. Bold keys run a little wider.
const NARROW = /[il.,:;'|!ftjrI \[\]()]/, WIDE = /[mwMW@%]/, CAPS = /[A-Z0-9+]/;
const charWidth = (c) => (NARROW.test(c) ? 4.5 : WIDE.test(c) ? 11 : CAPS.test(c) ? 9 : 7.5);
const textWidth = (text, bold = false) => Math.ceil([...text].reduce((w, c) => w + charWidth(c), 0) * (bold ? 1.08 : 1));

// One column's widths: its longest key, its longest label (all of it: labels are never cut),
// and the column, key + arrow + label with the gaps between.
export const keyWidth = (col) => Math.max(...col.map((i) => textWidth(i.key, true))) + 4;
export const labelWidth = (col) => Math.max(...col.map((i) => textWidth(itemText(i)))) + 4;
export const columnWidth = (col) => keyWidth(col) + INNER + ARROW + INNER + labelWidth(col);

// The items in columns filled top to bottom, each as wide as its own items: the most columns
// that fit the width. { columns, rows }.
export function hintsColumns(items, width) {
  for (let cols = Math.max(1, items.length); cols >= 1; cols--) {
    const rows = Math.ceil(items.length / cols);
    const columns = Array.from({ length: cols }, (_, c) => items.slice(c * rows, c * rows + rows)).filter((c) => c.length);
    const used = columns.reduce((sum, col) => sum + columnWidth(col), 0) + GAP * (columns.length - 1);
    if (used <= width - 2 * PAD || cols === 1) return { columns, rows: Math.max(1, rows) };
  }
  return { columns: [items], rows: Math.max(1, items.length) };
}

// The bar's height when it isn't measured yet (mod.json's size), and the window's width.
const BAR_HEIGHT = 22, WIDTH = 900;
// The box with no bar shown: its width, and its distance from the window's edges (px).
const CORNER = 480, EDGE = 6;

// Where the box goes, { width, height, at? } (no `at` without a viewport: Herdr places it).
// bar: the bar it docks on, { place: its props, size: its drawn size { width, height } | null
// (not measured) }, or null with no bar shown.
// On a bar: as wide as the bar block (the bar and a border hintsAlignBorder wide around it),
// which ends hintsAlignRight px from the window's right edge, hintsGap (6) px above the block's
// top. A bar not measured is taken as reaching from the window's left edge, BAR_HEIGHT high.
// With no bar: CORNER px wide (the window's width less EDGE on each side, if narrower) at the
// window's bottom right, EDGE px in.
export function hintsBox(items, viewport, bar) {
  const vp = viewport ?? null;
  if (!bar) {
    const width = vp ? Math.max(0, Math.min(CORNER, vp.width - 2 * EDGE)) : CORNER;
    const height = HEAD + hintsColumns(items, width).rows * ROW + 10;
    if (!vp) return { width, height };
    return { width, height, at: { x: Math.max(0, vp.width - EDGE - width), y: Math.max(8, vp.height - EDGE - height) } };
  }
  const right = num(bar.place.hintsAlignRight, 0), border = num(bar.place.hintsAlignBorder, 0), gap = num(bar.place.hintsGap, 6);
  const inner = bar.size ?? { width: vp ? Math.max(0, vp.width - right - 2 * border) : WIDTH, height: BAR_HEIGHT };
  const width = Math.round(inner.width + 2 * border);
  const height = HEAD + hintsColumns(items, width).rows * ROW + 10;
  if (!vp) return { width, height };
  const at = { x: Math.max(0, vp.width - right - width), y: Math.max(8, vp.height - (inner.height + 2 * border) - height - gap) };
  return { width, height, at };
}

// A place prop: a number, else its default.
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
