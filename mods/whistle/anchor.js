// The anchor (ADR 0018): a 0 px block that draws nothing, only holds the keyboard for whistle in
// WHISTLE (handle) and passes the keys pressed there on (onKey). The bar draws in bar.js.

import { div } from "gpui-kit";

export function renderAnchor(handle, onKey) {
  return div().id("whistle-anchor").track_focus(handle).size_full().on_key_down(onKey);
}
