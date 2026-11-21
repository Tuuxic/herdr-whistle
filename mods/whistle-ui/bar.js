// The bar: draws what ui.js's model says the bar shows, and nothing else.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

// vm: { badge, label, marker, problem? }; t: theme(); onSize(size): the bar's drawn size, for
// docking the hints box on it.
// Inert, there is no badge, only why (`problem`, in `blocked`). Switched off or whistle not
// running, there is no badge either: the label in `muted`, and the marker.
export function renderBar(vm, t, onSize) {
  const on = vm.badge === "WHISTLE";
  const row = h_flex()
    .id("whistle-ui")
    .size_full()
    .bg(t.chrome)
    .items_center()
    .gap(10)
    .text_size(11.5)
    .on_size_change(onSize);
  const marker = vm.marker ? div().flex_none().pr(10).text_color(t.blocked).child(vm.marker) : div();
  if (vm.problem) return row.px(10).child(div().flex_1().min_w(0).truncate().text_color(t.blocked).child(vm.problem));
  if (!vm.badge) return row.pl(10).child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(vm.label ?? "")).child(marker);
  // The mode badge in the theme's accent colours: WHISTLE filled (accent_foreground on accent),
  // TYPE outlined (accent on the bar).
  const badge = h_flex().id("whistle-ui-mode").h_full().px(10).flex_none().items_center().font_bold();
  return row
    .child((on ? badge.bg(t.accent).text_color(t.accent_foreground) : badge.border_1().border_color(t.accent).text_color(t.accent))
      .child(vm.badge))
    .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(vm.label))
    // Config problems: a short marker at the end; the settings list them.
    .child(marker);
}
