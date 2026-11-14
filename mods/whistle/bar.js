// The bar: draws the bar's view model (step.js bar()) and nothing else.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

// vm: { badge, label }; t: theme(); handle: the bar's focus handle; onKey(e, cx).
export function renderBar(vm, t, handle, onKey) {
  const on = vm.badge === "WHISTLE";
  return h_flex()
    .id("whistle")
    .track_focus(handle)
    .size_full()
    .bg(t.chrome)
    .items_center()
    .gap(10)
    .text_size(11.5)
    .on_key_down(onKey)
    .child(h_flex().id("whistle-mode").h_full().px(10).flex_none().items_center().font_bold()
      .bg(on ? t.accent : t.done).text_color(t.background)
      .child(vm.badge))
    .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(vm.label));
}
