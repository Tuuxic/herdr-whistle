// The key hints: a window overlay docked on top of the status bar, as wide as the bar, that
// lists what can follow the keys typed so far (shared("whistle.leader")), the way which-key's
// classic layout does: a title row with the keys and the group's name, then columns filled
// top to bottom, as many as fit. A window doesn't take the keyboard, so WHISTLE keeps
// it. The main copy opens it at the size hintsSize() gives and closes it when done.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, shared } from "herdr";
import { keyLabel } from "./keynames.js";

// Row height, side padding, the title row, the gap between columns, a character's width (est.).
const ROW = 18, PAD = 12, HEAD = 22, GAP = 32, CH = 7.2;
const labelOf = (i) => (i.group ? `+${i.label}` : i.label);
// One column's widths: its longest key, and key + arrow + its longest label.
const keyW = (col) => Math.ceil(Math.max(...col.map((i) => keyLabel(i.key).length)) * CH) + 4;
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

export function hintsSize(items, width) {
  const { rows } = layoutOf(items, width);
  return { width, height: HEAD + rows * ROW + 10 };
}

export function renderHints(width) {
  const t = theme();
  const v = shared("whistle.leader");
  if (!v) return div().size_full();
  const { columns } = layoutOf(v.items, width);
  // One box: the border all round, the title row inside it on the box's background.
  const top = h_flex().h(HEAD).flex_none().px(PAD).gap(8).items_center()
    .child(div().font_bold().text_color(t.accent).child(v.keys))
    .child(div().text_size(11).font_medium().text_color(t.foreground).child(v.title))
    .child(div().flex_1())
    .child(div().text_size(11).text_color(t.dim).child(v.exit ?? ""));
  return v_flex().id("whistle-hints").size_full().bg(t.chrome).border_1().border_color(t.accent).text_size(12)
    .child(top)
    .child(h_flex().flex_1().items_start().gap(GAP).px(PAD).pb(8)
      .children(columns.map((col) => v_flex().w(colW(col)).flex_none()
        .children(col.map((i) => h_flex().h(ROW).gap(8).items_center()
          .child(div().w(keyW(col)).flex_none().font_bold().text_color(t.accent).child(keyLabel(i.key)))
          .child(div().text_color(t.dim).child("→"))
          .child(div().min_w(0).truncate().text_color(i.group ? t.accent : t.foreground).child(labelOf(i))))))));
}
