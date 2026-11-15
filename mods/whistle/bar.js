// The bar: draws the bar's view model (step.js bar()) and nothing else.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

// vm: { badge, label, marker, problem }; t: theme(); handle: the bar's focus handle; onKey(e, cx);
// onSize(size): the bar's drawn size, for docking the hints on it.
// Inert, there is no badge, only why.
export function renderBar(vm, t, handle, onKey, onSize) {
  const on = vm.badge === "WHISTLE";
  const row = h_flex()
    .id("whistle")
    .track_focus(handle)
    .size_full()
    .bg(t.chrome)
    .items_center()
    .gap(10)
    .text_size(11.5)
    .on_size_change(onSize ?? (() => {}))
    .on_key_down(onKey);
  if (!vm.badge) return row.px(10).child(div().flex_1().min_w(0).truncate().text_color(t.blocked).child(vm.problem ?? ""));
  return row
    .child(h_flex().id("whistle-mode").h_full().px(10).flex_none().items_center().font_bold()
      .bg(on ? t.accent : t.done).text_color(t.background)
      .child(vm.badge))
    .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(vm.label))
    // Config problems: a short marker at the end; settings list them.
    .child(vm.marker ? div().flex_none().pr(10).text_color(t.blocked).child(vm.marker) : div());
}
