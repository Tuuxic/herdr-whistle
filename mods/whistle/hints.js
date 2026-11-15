// The hints: draws the hints' view model (views.js hints()) and nothing else. A window overlay
// docked on top of the bar, as wide as it: a title row with the keys and the group's name, then
// columns filled top to bottom, as many as fit. A window doesn't take the keyboard, so WHISTLE keeps it. The bar's copy opens it at hintsSize() and
// closes it when the sequence ends.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";

// Row height, side padding, the title row, the gap between columns, a character's width (est.).
const ROW = 18, PAD = 12, HEAD = 22, GAP = 32, CH = 7.2;
const labelOf = (i) => (i.group ? `+${i.label}` : i.label);
// One column's widths: its longest key, and key + arrow + its longest label.
const keyW = (col) => Math.ceil(Math.max(...col.map((i) => i.key.length)) * CH) + 4;
const colW = (col) => keyW(col) + 8 + 10 + 8 + Math.ceil(Math.max(...col.map((i) => labelOf(i).length)) * CH);

// Columns filled top to bottom, each as wide as its own entries: the most columns that fit.
function layoutOf(items, width) {
  for (let cols = Math.max(1, items.length); cols >= 1; cols--) {
    const rows = Math.ceil(items.length / cols);
    const columns = Array.from({ length: cols }, (_, c) => items.slice(c * rows, c * rows + rows)).filter((c) => c.length);
    const used = columns.reduce((sum, col) => sum + colW(col), 0) + GAP * (columns.length - 1);
    if (used <= width - 2 * PAD || cols === 1) return { columns, rows: Math.max(1, rows) };
  }
  return { columns: [items], rows: Math.max(1, items.length) };
}

// The window's size for these items at this width.
export function hintsSize(items, width) {
  const { rows } = layoutOf(items, width);
  return { width, height: HEAD + rows * ROW + 10 };
}

// vm: { keys, title, items: [{ key, label, group }], exit } | null; width: the window's; t: theme().
export function renderHints(vm, width, t) {
  if (!vm) return div().size_full();
  const { columns } = layoutOf(vm.items, width);
  // One box: the border all round, the title row inside it on the box's background.
  const top = h_flex().h(HEAD).flex_none().px(PAD).gap(8).items_center()
    .child(div().font_bold().text_color(t.accent).child(vm.keys))
    .child(div().text_size(11).font_medium().text_color(t.foreground).child(vm.title))
    .child(div().flex_1())
    .child(div().text_size(11).text_color(t.dim).child(vm.exit ?? ""));
  return v_flex().id("whistle-hints").size_full().bg(t.chrome).border_1().border_color(t.accent).text_size(12)
    .child(top)
    .child(h_flex().flex_1().items_start().gap(GAP).px(PAD).pb(8)
      .children(columns.map((col) => v_flex().w(colW(col)).flex_none()
        .children(col.map((i) => h_flex().h(ROW).gap(8).items_center()
          .child(div().w(keyW(col)).flex_none().font_bold().text_color(t.accent).child(i.key))
          .child(div().text_color(t.dim).child("→"))
          .child(div().min_w(0).truncate().text_color(i.group ? t.accent : t.foreground).child(labelOf(i))))))));
}
