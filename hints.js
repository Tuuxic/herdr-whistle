// The key hints: a window overlay just above the status bar that lists what can follow the
// keys typed so far (shared("whistle.leader")). A window doesn't take the keyboard, so WHISTLE
// keeps it. The main copy opens it at the size hintsSize() gives and closes it when done.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, shared } from "herdr";

const COL = 210, ROW = 18, ROWS = 8, PAD = 12, HEAD = 26;
const show = (k) => (k === "space" ? "SPC" : k);

// Columns of at most ROWS, as many as fit in maxWidth.
function layoutOf(n, maxWidth) {
  const fit = Math.max(1, Math.floor((maxWidth - 2 * PAD) / COL));
  const cols = Math.max(1, Math.min(fit, Math.ceil(n / ROWS)));
  return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
}

export function hintsSize(n, maxWidth) {
  const { cols, rows } = layoutOf(n, maxWidth);
  return { width: Math.max(260, cols * COL + 2 * PAD), height: 2 * 8 + HEAD + rows * ROW + 2 };
}

export function renderHints(maxWidth) {
  const t = theme();
  const v = shared("whistle.leader");
  if (!v) return div().size_full();
  const { cols, rows } = layoutOf(v.items.length, maxWidth);
  const columns = Array.from({ length: cols }, (_, c) => v.items.slice(c * rows, c * rows + rows)).filter((c) => c.length);
  return v_flex().id("whistle-hints").size_full().bg(t.chrome).border_1().border_color(t.accent).px(PAD).py(8).text_size(12)
    .child(h_flex().h(HEAD - 6).mb(6).gap(10).items_center()
      .child(div().font_bold().text_color(t.accent).child(v.keys))
      .child(div().text_size(11).font_medium().text_color(t.foreground).child(v.title.toUpperCase()))
      .child(div().flex_1())
      .child(div().text_size(11).text_color(t.dim).child("Esc · ⌫")))
    .child(h_flex().items_start().children(columns.map((col) => v_flex().w(COL).flex_none()
      .children(col.map((i) => h_flex().h(ROW).gap(8).items_center()
        .child(div().w(30).flex_none().font_bold().text_color(t.accent).child(show(i.key)))
        .child(div().text_color(t.dim).child("→"))
        .child(div().min_w(0).truncate().text_color(i.group ? t.accent : t.foreground).child(i.group ? `+${i.label}` : i.label)))))));
}
