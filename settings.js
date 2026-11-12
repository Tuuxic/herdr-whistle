// Whistle's own settings: a dialog (whistle.settings, Space w, or a click on the mode badge)
// with WHISTLE on/off, the key hints on/off and every mapping in effect. The toggles write
// ~/.config/herdr-app/whistle.json; the main copy notices within a few seconds.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme } from "herdr";
import { flatten } from "./config.js";

const row = (t, title, about, control) => h_flex().w_full().gap(16).py(10).items_center().border_b(1).border_color(t.border)
  .child(v_flex().flex_1().min_w(0).gap(3)
    .child(div().text_size(13.5).text_color(t.foreground).child(title))
    .child(div().text_size(12).line_height("17px").text_color(t.dim).child(about)))
  .child(div().flex_none().child(control));

const toggle = (t, id, on, onClick) => div().id(id).w(36).h(20).p(2).cursor_pointer().bg(on ? t.accent : t.hover).flex()
  .when(on, (el) => el.justify_end()).on_click(onClick)
  .child(div().w(16).h(16).bg(on ? t.accent_foreground : t.muted));

const chip = (t, k) => div().px(5).h(18).flex().items_center().border_1().border_color(t.border).bg(t.background)
  .text_size(11.5).text_color(t.foreground).child(k === "space" ? "SPC" : k);

// One choice of several: the picked one in the accent.
const choice = (t, id, label, on, onClick) => div().id(id).px(10).h(24).flex().items_center().cursor_pointer()
  .border_1().border_color(on ? t.accent : t.border).bg(on ? t.accent : t.background)
  .text_size(12).text_color(on ? t.background : t.muted).hover((s) => (on ? s : s.text_color(t.foreground)))
  .on_click(onClick).child(label);

// conf: what load() returned; set(key, value): writes it; place: the layout's bars when it has
// more than one ({ names, current }), else null.
export function renderSettings(conf, set, place) {
  const t = theme();
  const rows = flatten(conf?.map);
  return v_flex().id("whistle-settings").size_full().min_h(0).p(18).gap(6).bg(t.chrome).text_color(t.foreground)
    .child(h_flex().gap(10).items_center().pb(6)
      .child(div().text_size(15).font_semibold().child("Whistle"))
      .child(div().flex_1())
      .child(div().text_size(11).text_color(t.dim).child("Esc closes")))
    .when(Boolean(conf?.error), (el) => el.child(div().py(6).text_size(12.5).text_color(t.blocked).child(conf.error)))
    .child(row(t, "Whistle mode", "Ctrl+Space (or Ctrl+[ in a terminal) leaves the terminal to move around and run mappings with single keys. Off: those keys go to the terminal and the status bar shows no mode.",
      toggle(t, "wh-enabled", conf?.enabled !== false, () => set("enabled", conf?.enabled === false))))
    .when(conf?.enabled !== false, (el) => el.child(row(t, "Show key hints", "After a group key like w or Space, a box above the status bar lists the keys that can follow. Off: only the status bar shows what you typed.",
      toggle(t, "wh-hints", conf?.hints !== false, () => set("hints", conf?.hints === false)))))
    .when(Boolean(place), (el) => el.child(row(t, "Bar position", "Where the status bar with the mode goes. This layout has a spot for each.",
      h_flex().gap(4).children(place.names.map((name, i) => choice(t, `wh-bar-${i}`, name, name === place.current, () => set("bar", name)))))))
    .child(div().pt(12).pb(4).text_size(11).font_semibold().text_color(t.dim).child(`MAPPINGS · ${rows.length}`))
    .child(v_flex().id("wh-maps").flex_1().min_h(0).overflow_y_scrollbar()
      .children(rows.map((m, i) => h_flex().id(`wh-m-${i}`).h(26).flex_none().px(6).gap(12).items_center().hover((s) => s.bg(t.hover))
        .child(h_flex().w(150).flex_none().gap(3).items_center().children(m.seq.flatMap((p, j) => [
          ...(j ? [div().text_size(11).text_color(t.dim).child("›")] : []), chip(t, p)])))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(m.action))
        .when(Boolean(m.group), (e) => e.child(div().flex_none().text_size(11).text_color(t.dim).child(m.group))))))
    .child(div().pt(8).text_size(11.5).line_height("17px").text_color(t.dim)
      .child("Your own mappings go in ~/.config/herdr-app/whistle.json: { \"map\": { \"x\": [\"Label\", \"command\"] } }, over the defaults and this layout's. A key set to null removes it."));
}
