// The hints: draws the hints' view model (views.js hints()) and nothing else. A window overlay
// docked on top of the bar, as wide as it: a title row with the keys and the group's name, then
// columns filled top to bottom, as many as fit. A window doesn't take the keyboard, so WHISTLE
// keeps it. The core opens it, docked by views.js hintsBox(), and closes it when the sequence
// ends.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { HINTS_BOX, hintsColumns, keyWidth, labelWidth, columnWidth } from "./views.js";

const { ROW, PAD, HEAD, GAP, ARROW, INNER } = HINTS_BOX;
const labelOf = (i) => (i.group ? `+${i.label}` : i.label);

// vm: { keys, title, items: [{ key, label, group }], exit } | null; width: the window's; t: theme().
export function renderHints(vm, width, t) {
  if (!vm) return div().size_full();
  const { columns } = hintsColumns(vm.items, width);
  // One box: the border all round, the title row inside it on the box's background.
  const top = h_flex().h(HEAD).flex_none().px(PAD).gap(8).items_center()
    .child(div().font_bold().text_color(t.accent).child(vm.keys))
    .child(div().text_size(11).font_medium().text_color(t.foreground).child(vm.title))
    .child(div().flex_1())
    .child(div().text_size(11).text_color(t.dim).child(vm.exit ?? ""));
  return v_flex().id("whistle-hints").size_full().bg(t.chrome).border_1().border_color(t.accent).text_size(12)
    .child(top)
    .child(h_flex().flex_1().items_start().gap(GAP).px(PAD).pb(8)
      .children(columns.map((col) => v_flex().w(columnWidth(col)).flex_none()
        .children(col.map((i) => h_flex().h(ROW).gap(INNER).items_center()
          .child(div().w(keyWidth(col)).flex_none().font_bold().text_color(t.accent).child(i.key))
          .child(div().w(ARROW).flex_none().text_color(t.dim).child("→"))
          .child(div().w(labelWidth(col)).flex_none().whitespace_nowrap().text_color(i.group ? t.accent : t.foreground).child(labelOf(i))))))));
}
