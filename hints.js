// The key hints: a window overlay docked on top of the status bar, as wide as the bar, that
// lists what can follow the keys typed so far (shared("whistle.leader")), the way which-key's
// classic layout does: the keys and the group's name set into the top border, then columns
// filled top to bottom, as many as fit. A window doesn't take the keyboard, so WHISTLE keeps
// it. The main copy opens it at the size hintsSize() gives and closes it when done.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, shared } from "herdr";

// Row height, side padding, the title row, the gap between columns, a character's width (est.).
const ROW = 18, PAD = 12, HEAD = 22, GAP = 28, CH = 7.2, KEY = 30;
const show = (k) => (k === "space" ? "SPC" : k);
const labelOf = (i) => (i.group ? `+${i.label}` : i.label);

// Columns as wide as the longest entry, as many as fit in width; rows to hold the rest.
function layoutOf(items, width) {
  const longest = Math.max(4, ...items.map((i) => labelOf(i).length));
  const colW = Math.ceil(KEY + 8 + 10 + 8 + longest * CH + GAP);
  const cols = Math.max(1, Math.min(items.length, Math.floor((width - 2 * PAD) / colW)));
  return { colW, cols, rows: Math.max(1, Math.ceil(items.length / cols)) };
}

export function hintsSize(items, width) {
  const { rows } = layoutOf(items, width);
  return { width, height: HEAD + rows * ROW + 10 };
}

export function renderHints(width) {
  const t = theme();
  const v = shared("whistle.leader");
  if (!v) return div().size_full();
  const { colW, cols, rows } = layoutOf(v.items, width);
  const columns = Array.from({ length: cols }, (_, c) => v.items.slice(c * rows, c * rows + rows)).filter((c) => c.length);
  // The top border, drawn in pieces so the title sits in a gap in it.
  const half = HEAD / 2;
  const edge = (side) => div().w(10).h_full().flex_none().relative()
    .child(div().absolute().top(half).left(0).right(0).bottom(0).border_t(1).border_color(t.accent)
      .when(side === "left", (el) => el.border_l(1)).when(side === "right", (el) => el.border_r(1)));
  const rule = () => div().flex_1().h_full().relative().child(div().absolute().top(half).left(0).right(0).h(1).bg(t.accent));
  const top = h_flex().h(HEAD).flex_none().items_center()
    .child(edge("left"))
    .child(h_flex().px(6).gap(8).items_center()
      .child(div().font_bold().text_color(t.accent).child(v.keys))
      .child(div().text_size(11).font_medium().text_color(t.foreground).child(v.title)))
    .child(rule())
    .child(div().px(6).text_size(11).text_color(t.dim).child("Esc · ⌫"))
    .child(edge("right"));
  return v_flex().id("whistle-hints").size_full().bg(t.chrome).text_size(12)
    .child(top)
    .child(h_flex().flex_1().items_start().px(PAD).pb(8).border_l(1).border_r(1).border_b(1).border_color(t.accent)
      .children(columns.map((col) => v_flex().w(colW).flex_none()
        .children(col.map((i) => h_flex().h(ROW).gap(8).items_center()
          .child(div().w(KEY).flex_none().font_bold().text_color(t.accent).child(show(i.key)))
          .child(div().text_color(t.dim).child("→"))
          .child(div().min_w(0).truncate().text_color(i.group ? t.accent : t.foreground).child(labelOf(i))))))));
}
